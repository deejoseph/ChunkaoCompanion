const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const PDFParser = require('pdf2json');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const EXAMS_ROOT = path.join(PROJECT_ROOT, 'data/exams');
const DB_PATH = path.join(PROJECT_ROOT, 'data/knowledge/chunkao.db');

const SUBJECT_NAMES = new Set(['chinese', 'math', 'english']);

function stableId(...parts) {
    const raw = parts.filter(part => part !== undefined && part !== null).join('::');
    const safe = raw
        .replace(/[^\w\-\u4e00-\u9fff]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120) || 'item';
    const digest = crypto.createHash('sha1').update(raw, 'utf8').digest('hex').slice(0, 10);
    return `${safe}_${digest}`;
}

function safeDecodePdfText(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function cleanText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u0000/g, '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function parsePdfToPages(filePath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on('pdfParser_dataError', (err) => {
            reject(err.parserError || err);
        });

        pdfParser.on('pdfParser_dataReady', (pdfData) => {
            const pages = (pdfData.Pages || []).map((page, pageIndex) => {
                const textItems = [];
                for (const item of page.Texts || []) {
                    const value = (item.R || []).map(r => safeDecodePdfText(r.T || '')).join('');
                    if (value.trim()) {
                        textItems.push({ x: item.x || 0, y: item.y || 0, text: value });
                    }
                }

                textItems.sort((a, b) => (a.y - b.y) || (a.x - b.x));

                const lines = [];
                for (const item of textItems) {
                    const last = lines[lines.length - 1];
                    if (last && Math.abs(last.y - item.y) < 0.35) {
                        last.items.push(item);
                    } else {
                        lines.push({ y: item.y, items: [item] });
                    }
                }

                const text = lines.map(line => line.items
                    .sort((a, b) => a.x - b.x)
                    .map(item => item.text)
                    .join(' ')
                ).join('\n');

                return {
                    pageNumber: pageIndex + 1,
                    text: cleanText(text)
                };
            });

            resolve(pages);
        });

        pdfParser.loadPDF(filePath);
    });
}

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walk(fullPath, out);
        } else if (stat.isFile() && name.toLowerCase().endsWith('.pdf')) {
            out.push(fullPath);
        }
    }
    return out;
}

function inferYear(text) {
    const match = String(text || '').match(/20\d{2}/);
    return match ? Number(match[0]) : null;
}

function inferRole(filePath) {
    const name = path.basename(filePath);
    if (/学生版|考试版|试卷$|试卷\.pdf$/i.test(name)) return 'student';
    if (/教师版|答案|解析|含答案|答案解析|试卷及答案/i.test(name)) return 'teacher';
    return 'reference';
}

function discoverExamGroups() {
    const groups = new Map();

    for (const subject of SUBJECT_NAMES) {
        const subjectDir = path.join(EXAMS_ROOT, subject);
        for (const filePath of walk(subjectDir)) {
            const rel = path.relative(PROJECT_ROOT, filePath);
            if (rel.split(path.sep).includes('mock')) continue;
            const year = inferYear(rel);
            if (!year || year === 2026) continue;

            const key = `${subject}:${year}`;
            if (!groups.has(key)) {
                groups.set(key, { subject, year, files: [] });
            }
            groups.get(key).files.push({
                path: filePath,
                role: inferRole(filePath),
                name: path.basename(filePath)
            });
        }
    }

    return [...groups.values()].sort((a, b) => {
        if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
        return a.year - b.year;
    });
}

function chooseSourceFile(group) {
    const teacherVersion = group.files.find(file => /教师版/.test(file.name));
    if (teacherVersion) return teacherVersion;
    const combined = group.files.find(file => /含答案|试卷及答案|答案解析|解析/.test(file.name));
    if (combined) return combined;
    return group.files.find(file => file.role === 'teacher') || group.files[0];
}

function chooseQuestionFile(group) {
    const studentVersion = group.files.find(file => /学生版|考试版/.test(file.name));
    if (studentVersion) return studentVersion;
    const paperOnly = group.files.find(file => /试卷\.pdf$|真题.*\.pdf$/.test(file.name) && !/答案|解析|教师版/.test(file.name));
    if (paperOnly) return paperOnly;
    return chooseSourceFile(group);
}

function getQuestionPattern(subject) {
    if (subject === 'english') {
        return /(?:^|\n)\s*(\d{1,2})\s*[.．]\s*/g;
    }
    return /(?:^|\n)\s*(\d{1,2})\s*[.．、]\s*/g;
}

function inferQuestionType(subject, content) {
    if (subject === 'english' && /[A-D]\s*[.．]/.test(content)) return 'choice';
    if (/[A-D]\s*[.．、)]/.test(content)) return 'choice';
    if (/_{2,}|____|（\s*）|\(\s*\)/.test(content)) return 'fill';
    if (/作文|写作|Write|writing/i.test(content)) return 'essay';
    return 'qa';
}

function splitQuestions(subject, pages) {
    const text = pages.map(page => `\n[[PAGE:${page.pageNumber}]]\n${page.text}`).join('\n');
    const pageMarkers = [...text.matchAll(/\[\[PAGE:(\d+)]]/g)]
        .filter(match => match.index !== undefined)
        .map(match => ({ index: match.index, pageNumber: Number(match[1]) }));
    const pattern = getQuestionPattern(subject);
    const matches = [...text.matchAll(pattern)]
        .filter(match => match.index !== undefined)
        .map(match => ({ index: match.index, number: Number(match[1]) }))
        .filter(match => match.number >= 1 && match.number <= 80);

    if (!matches.length) return [];

    const questions = [];
    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
        const block = cleanText(text.slice(start, end));
        const pageMarker = [...pageMarkers].reverse().find(marker => marker.index <= start);
        const pageNumber = pageMarker ? pageMarker.pageNumber : null;
        const content = cleanText(block
            .replace(/\[\[PAGE:\d+]]/g, '')
            .replace(/^(?:\d{1,2})\s*[.．、]\s*/, '')
        );

        if (content.length < 8) continue;
        if (/^(参考答案|答案|解析|听力原文)/.test(content)) continue;

        questions.push({
            number: questions.length + 1,
            originalNumber: String(matches[i].number),
            type: inferQuestionType(subject, content),
            content,
            pageNumber
        });
    }

    return questions;
}

function extractAnswerForQuestion(subject, content) {
    if (subject === 'math') {
        const match = content.match(/故答案为[:：]?\s*([^\n。．]+)/);
        return match ? cleanText(match[1]) : '';
    }
    if (subject === 'english') {
        const match = content.match(/(?:答案|Answer)[:：]?\s*([A-D](?:\s+[A-D])*)/i);
        return match ? cleanText(match[1]) : '';
    }
    if (subject === 'chinese') {
        const match = content.match(/(?:答案|参考答案)[:：]?\s*([^\n]+)/);
        return match ? cleanText(match[1]) : '';
    }
    return '';
}

async function ensureSubjects(db) {
    await db.run("INSERT OR REPLACE INTO subjects(id, name) VALUES ('chinese', '语文')");
    await db.run("INSERT OR REPLACE INTO subjects(id, name) VALUES ('math', '数学')");
    await db.run("INSERT OR REPLACE INTO subjects(id, name) VALUES ('english', '英语')");
}

async function importGroup(db, group) {
    const sourceFile = chooseSourceFile(group);
    const questionFile = chooseQuestionFile(group);
    const relPath = path.relative(PROJECT_ROOT, sourceFile.path);
    const questionRelPath = path.relative(PROJECT_ROOT, questionFile.path);
    const pages = await parsePdfToPages(questionFile.path);
    const questions = splitQuestions(group.subject, pages);
    const now = new Date().toISOString().slice(0, 19);
    const bankId = stableId('exam', group.subject, group.year);
    const title = `${group.year}年上海春考${group.subject}真题`;

    await db.run(
        `INSERT INTO question_banks(
            id, topic_id, subject_id, version_id, title, source_title, source_path,
            source_format, paper_type, year, total_questions, created_at, updated_at
        )
        VALUES (?, NULL, ?, NULL, ?, ?, ?, 'pdf', 'exam', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            source_title=excluded.source_title,
            source_path=excluded.source_path,
            source_format=excluded.source_format,
            paper_type=excluded.paper_type,
            year=excluded.year,
            total_questions=excluded.total_questions,
            updated_at=excluded.updated_at`,
        [bankId, group.subject, title, sourceFile.name, questionRelPath, group.year, questions.length, now, now]
    );

    await db.run(
        `DELETE FROM question_assets
         WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ? AND source = 'exam_pdf')`,
        [bankId]
    );
    await db.run(
        `DELETE FROM question_knowledge_points
         WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ? AND source = 'exam_pdf')`,
        [bankId]
    );
    await db.run(`DELETE FROM questions WHERE bank_id = ? AND source = 'exam_pdf'`, [bankId]);

    for (const question of questions) {
        const questionId = stableId('exam_question', bankId, question.originalNumber, question.number);
        const answer = extractAnswerForQuestion(group.subject, question.content);
        const parseConfidence = group.subject === 'math' ? 0.45 : 0.68;
        const needsReview = group.subject === 'math' || !answer ? 1 : 0;

        await db.run(
            `INSERT INTO questions(
                id, bank_id, topic_id, subject_id, version_id, number, original_number, type,
                content, source_answer, final_answer, analysis, score, difficulty, page_number,
                parse_confidence, needs_review, source, raw_json, created_at, updated_at
            )
            VALUES (?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, '', NULL, NULL, ?, ?, ?, 'exam_pdf', ?, ?, ?)`,
            [
                questionId,
                bankId,
                group.subject,
                question.number,
                question.originalNumber,
                question.type,
                question.content,
                answer,
                answer,
                question.pageNumber,
                parseConfidence,
                needsReview,
                JSON.stringify({
                    sourcePath: relPath,
                    sourceFile: sourceFile.name,
                    questionPath: questionRelPath,
                    questionFile: questionFile.name
                }, null, 0),
                now,
                now
            ]
        );

        await db.run(
            `INSERT OR REPLACE INTO question_assets(id, question_id, asset_type, file_path, page_number, bbox_json, description, created_at)
             VALUES (?, ?, 'source_pdf_page', ?, ?, NULL, ?, ?)`,
            [
                stableId('asset', questionId, questionRelPath, question.pageNumber || ''),
                questionId,
                questionRelPath,
                question.pageNumber,
                '原 PDF 页码引用，用于公式、图形和版式校对',
                now
            ]
        );
    }

    return {
        subject: group.subject,
        year: group.year,
        file: questionRelPath,
        referenceFile: relPath,
        pages: pages.length,
        questions: questions.length,
        needsReview: questions.filter(q => group.subject === 'math' || !extractAnswerForQuestion(group.subject, q.content)).length
    };
}

async function main() {
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    const groups = discoverExamGroups();
    const targetGroups = groups.filter(group => group.files.some(file => file.path.toLowerCase().endsWith('.pdf')));
    const results = [];

    try {
        await ensureSubjects(db);
        for (const group of targetGroups) {
            try {
                results.push(await importGroup(db, group));
            } catch (error) {
                results.push({
                    subject: group.subject,
                    year: group.year,
                    error: error.message
                });
            }
        }

        const summary = await db.all(
            `SELECT subject_id AS subject, COUNT(DISTINCT bank_id) AS banks, COUNT(*) AS questions
             FROM questions
             WHERE source = 'exam_pdf'
             GROUP BY subject_id
             ORDER BY subject_id`
        );

        await db.run(
            `DELETE FROM question_assets
             WHERE question_id NOT IN (SELECT id FROM questions)`
        );
        await db.run(
            `DELETE FROM question_knowledge_points
             WHERE question_id NOT IN (SELECT id FROM questions)`
        );

        console.log(JSON.stringify({
            success: true,
            imported: results,
            summary
        }, null, 2));
    } finally {
        await db.close();
    }
}

main().catch(error => {
    console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
    process.exit(1);
});
