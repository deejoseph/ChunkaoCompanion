const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// 答案库目录
const BANKS_DIR = path.join(__dirname, '../../data/question_banks');
const DB_PATH = path.join(__dirname, '../../data/knowledge/chunkao.db');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PYTHON = process.env.PYTHON_PATH || process.env.WHISPER_PYTHON_PATH || 'python';
const IMPORT_ALL_EXAMS_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/import_all_exam_banks.py');
const COMPLETE_EXAM_GAPS_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/complete_exam_gaps.py');

function runPython(script, args = []) {
    return new Promise((resolve, reject) => {
        execFile(PYTHON, [script, ...args], {
            cwd: PROJECT_ROOT,
            maxBuffer: 50 * 1024 * 1024,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8'
            }
        }, (error, stdout, stderr) => {
            if (error) {
                error.stderr = stderr;
                error.stdout = stdout;
                reject(error);
                return;
            }

            try {
                resolve(JSON.parse(stdout));
            } catch (parseError) {
                parseError.stdout = stdout;
                parseError.stderr = stderr;
                reject(parseError);
            }
        });
    });
}

// 确保目录存在
if (!fs.existsSync(BANKS_DIR)) {
    fs.mkdirSync(BANKS_DIR, { recursive: true });
}

function normalizeTitle(title = '') {
    return String(title)
        .replace(/\.pdf$/i, '')
        .replace(/（教师版）|（学生版）|（AI参考答案）/g, '')
        .replace(/\(教师版\)|\(学生版\)|\(AI参考答案\)/g, '')
        .replace(/（复习讲义）|（上海专用）/g, '')
        .replace(/\s+/g, '')
        .trim();
}

function parseJsonField(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function stableImportId(value, fallback = 'bank') {
    return String(value || fallback)
        .trim()
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120) || fallback;
}

function inferSubjectFromText(value) {
    const text = String(value || '');
    if (/数学|math/i.test(text)) return 'math';
    if (/英语|english/i.test(text)) return 'english';
    if (/语文|chinese/i.test(text)) return 'chinese';
    return null;
}

function formatOptions(options) {
    if (!Array.isArray(options) || options.length === 0) return '';
    return `\n${options.map(option => String(option)).join('\n')}`;
}

function sumSubQuestionScores(subQuestions = []) {
    return subQuestions.reduce((total, subQuestion) => {
        const score = Number(subQuestion.score ?? subQuestion.points ?? 0);
        return Number.isFinite(score) ? total + score : total;
    }, 0);
}

function normalizeShanghaiMathScore(sectionType, parentId, question = {}) {
    const numericId = Number(parentId);
    const subQuestions = Array.isArray(question.sub_questions) ? question.sub_questions : [];

    if (sectionType === 'fill_in_the_blank' && Number.isFinite(numericId)) {
        return numericId <= 6 ? 4 : 5;
    }

    if (sectionType === 'multiple_choice') {
        return 5;
    }

    if (sectionType === 'essay' && Number.isFinite(numericId)) {
        const essayScores = {
            17: 14,
            18: 14,
            19: 14,
            20: 16,
            21: 18
        };
        if (essayScores[numericId] != null) {
            return essayScores[numericId];
        }
    }

    if (question.total_score != null) {
        return question.total_score;
    }

    const subScore = sumSubQuestionScores(subQuestions);
    if (subScore > 0) {
        return subScore;
    }

    return question.score ?? question.points ?? null;
}

function flattenSectionQuestions(sections = []) {
    const flattened = [];
    let globalNumber = 0;

    for (const section of sections) {
        const sectionType = section.type || 'qa';
        const sectionDescription = section.description || '';
        
        for (const question of section.questions || []) {
            const parentId = question.id || (globalNumber + 1);
            const subQuestions = Array.isArray(question.sub_questions) ? question.sub_questions : [];
            
            if (subQuestions.length === 0) {
                globalNumber++;
                flattened.push({
                    id: `q${parentId}`,
                    number: globalNumber,
                    originalNumber: parentId,
                    type: sectionType === 'essay' ? 'qa' : sectionType,
                    content: question.content || question.title || '',
                    sourceAnswer: question.sourceAnswer || question.source_answer || question.answer || '',
                    finalAnswer: '',
                    analysis: question.analysis || question.explanation || '',
                    score: question.score ?? question.points ?? question.total_score ?? null,
                    difficulty: question.difficulty || '',
                    pageNumber: question.pageNumber || question.page_number || null,
                    images: question.images || [],
                    image: question.image || question.imagePath || question.image_path || '',
                    knowledgePoints: question.knowledgePoints || question.knowledge_points || [],
                    sectionType,
                    sectionDescription,
                    parentId: null
                });
            } else {
                // 有小题：为每个小题生成独立题目
                const totalParentScore = question.total_score ?? question.score ?? question.points;
                let avgScore = null;
                if (totalParentScore && subQuestions.length > 0) {
                    avgScore = totalParentScore / subQuestions.length;
                }
                
                for (const sub of subQuestions) {
                    globalNumber++;
                    const partLabel = sub.part ? `(${sub.part}) ` : '';
                    const subContent = sub.content || '';
                    const subAnswer = sub.answer || '';
                    const subAnalysis = sub.analysis || '';
                    
                    // 优先使用子题自带的 score，否则从父题平均分配
                    let subScore = sub.score ?? sub.points;
                    if (subScore == null && avgScore != null) {
                        subScore = parseFloat(avgScore.toFixed(1));
                        console.warn(`⚠️ 题目 ${parentId}.${sub.part || globalNumber} 缺失 score，已自动分配为 ${subScore}`);
                    } else if (subScore == null) {
                        subScore = null;
                        console.error(`❌ 题目 ${parentId}.${sub.part || globalNumber} 缺失 score 且父题无总分，请手动补充`);
                    }
                    
                    flattened.push({
                        id: `q${parentId}_p${sub.part || globalNumber}`,
                        number: globalNumber,
                        originalNumber: `${parentId}.${sub.part || globalNumber}`,
                        type: sectionType === 'essay' ? 'qa' : sectionType,
                        content: `${partLabel}${subContent}`.trim(),
                        sourceAnswer: subAnswer,
                        finalAnswer: '',
                        analysis: subAnalysis,
                        score: subScore,
                        difficulty: sub.difficulty || '',
                        pageNumber: sub.pageNumber || sub.page_number || null,
                        images: sub.images || [],
                        image: sub.image || '',
                        // 关键：保留子题的知识点
                        knowledgePoints: sub.knowledgePoints || sub.knowledge_points || [],
                        sectionType,
                        sectionDescription,
                        parentId: parentId
                    });
                }
            }
        }
    }
    return flattened;
}

function normalizeQuestionBankPayload(payload, originalName = 'question_bank.json') {
    const data = payload || {};
    const bank = data.bank || data.questionBank || data;
    const examInfo = bank.exam_info || bank.examInfo || {};
    const year = examInfo.year || bank.year || null;
    let title = bank.title || bank.name || bank.paperTitle || examInfo.title || path.basename(originalName, path.extname(originalName));
    // 统一添加年份前缀（如果年份存在且标题开头没有年份）
    if (year && !title.startsWith(`${year}年`)) {
        title = `${year}年 ${title}`;
    }
    const subject = bank.subject || bank.subjectId || bank.subject_id || inferSubjectFromText(`${title} ${examInfo.location || ''}`);
    const paperId = stableImportId(bank.paperId || bank.id || bank.bankId || (year && subject ? `${subject}_${year}_${title}` : title), 'json_bank');
    const rawQuestions = Array.isArray(bank.questions)
        ? bank.questions
        : Array.isArray(bank.items)
            ? bank.items
            : Array.isArray(bank.sections)
                ? flattenSectionQuestions(bank.sections)
                : [];

    return {
        paperId,
        title,
        sourceTitle: bank.sourceTitle || bank.source_title || title,
        subject,
        version: bank.version || bank.versionId || bank.version_id || '2026',
        sourcePath: bank.sourcePath || bank.source_path || '',
        sourceFormat: bank.sourceFormat || bank.source_format || 'json',
        paperType: bank.paperType || bank.paper_type || 'exam',
        year,
        knowledgePoints: bank.knowledgePoints || bank.knowledge_points || [],
        totalQuestions: rawQuestions.length,
        questions: rawQuestions.map((q, index) => ({
            id: q.id || q.questionId || q.question_id || `q${index + 1}`,
            number: q.number || q.no || index + 1,
            originalNumber: q.originalNumber || q.original_number || q.no || q.number || `q${index + 1}`,
            type: q.type || q.questionType || q.question_type || 'qa',
            content: q.content || q.question || q.stem || q.title || '',
            sourceAnswer: q.sourceAnswer || q.source_answer || q.answer || '',
            finalAnswer: q.finalAnswer || q.final_answer || '',
            myAnswer: q.myAnswer || q.my_answer || '',
            peerAnswers: q.peerAnswers || q.peer_answers || {},
            aiAnswers: q.aiAnswers || q.ai_answers || {},
            discussion: q.discussion || '',
            analysis: q.analysis || q.explanation || '',
            score: q.score ?? q.points ?? q.point ?? null,
            difficulty: q.difficulty || '',
            pageNumber: q.pageNumber || q.page_number || null,
            image: q.image || q.imagePath || q.image_path || '',
            images: q.images || [],
            knowledgePoints: q.knowledgePoints || q.knowledge_points || []
        }))
    };
}

async function openDb() {
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

// 上传题目资源（截图/公式图片等）并写入 question_assets 表
const multer = require('multer');
const ASSETS_BASE = path.join(__dirname, '../../data/question_assets');
if (!fs.existsSync(ASSETS_BASE)) fs.mkdirSync(ASSETS_BASE, { recursive: true });
const upload = multer({ dest: path.join(__dirname, '../../temp_uploads') });

router.post('/upload-asset', upload.single('file'), async (req, res) => {
    const file = req.file;
    const { bankId, questionId, assetType, pageNumber, bboxJson, description } = req.body;

    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    if (!bankId || !questionId) return res.status(400).json({ success: false, error: 'Missing bankId or questionId' });

    try {
        const ext = path.extname(file.originalname) || '.png';
        const safeName = `${Date.now()}_${Math.random().toString(36).slice(2,8)}${ext}`;
        const targetDir = path.join(ASSETS_BASE, bankId, questionId);
        fs.mkdirSync(targetDir, { recursive: true });
        const targetPath = path.join(targetDir, safeName);
        fs.renameSync(file.path, targetPath);

        const relativePath = path.relative(path.join(__dirname, '../..'), targetPath).replace(/\\/g, '/');

        const db = await openDb();
        const assetId = `${bankId}_${questionId}_${Date.now()}`;
        await db.run(
            `INSERT INTO question_assets (id, question_id, asset_type, file_path, page_number, bbox_json, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [assetId, `${bankId}_${questionId}`, assetType || 'screenshot', relativePath, pageNumber ? Number(pageNumber) : null, bboxJson || null, description || '']
        );
        await db.close();

        res.json({ success: true, assetId, filePath: relativePath });
    } catch (error) {
        console.error('upload-asset error:', error);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 上传题库 JSON 并写入 SQLite，同时生成 JSON 备份。
router.post('/import-all-exams', async (req, res) => {
    const skipEnrich = req.body?.skipEnrich === true || req.body?.skipEnrich === 'true';
    const skipLlm = req.body?.skipLlm === true || req.body?.skipLlm === 'true';
    const enrichOnly = req.body?.enrichOnly === true || req.body?.enrichOnly === 'true';
    const subject = req.body?.subject;

    try {
        const args = ['--json'];
        if (skipEnrich) args.push('--skip-enrich');
        if (skipLlm) args.push('--skip-llm');
        if (enrichOnly) args.push('--enrich-only');
        if (subject && ['chinese', 'math', 'english'].includes(subject)) {
            args.push('--subject', subject);
        }

        const result = await runPython(IMPORT_ALL_EXAMS_SCRIPT, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout
        });
    }
});

// 补全 final_answer/score/difficulty，并生成+导入知识点映射（耗时可长达数十分钟）
router.post('/complete-exam-gaps', async (req, res) => {
    const skipLlm = req.body?.skipLlm === true || req.body?.skipLlm === 'true';
    const forceDifficulty = req.body?.forceDifficulty !== false && req.body?.forceDifficulty !== 'false';
    const skipMapping = req.body?.skipMapping === true || req.body?.skipMapping === 'true';
    const subject = req.body?.subject;

    try {
        const args = ['--json'];
        if (skipLlm) args.push('--skip-llm');
        if (forceDifficulty) args.push('--force-difficulty');
        if (skipMapping) args.push('--skip-mapping');
        if (subject && ['chinese', 'math', 'english'].includes(subject)) {
            args.push('--subject', subject);
        }

        const result = await runPython(COMPLETE_EXAM_GAPS_SCRIPT, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout
        });
    }
});

// ─── 文件名编码修复 ────────────────────────────────────────────────────
// multer 默认以 latin1 解码 originalname，中文文件名会变成乱码。
// 此函数将 latin1 字节重新解释为 utf-8，还原中文文件名。
function decodeFilename(originalName) {
    if (!originalName) return originalName;
    try {
        return Buffer.from(originalName, 'latin1').toString('utf8');
    } catch {
        return originalName;
    }
}

// ─── 题库 JSON 双重防御校验 ────────────────────────────────────────────
// 第一级：文件名必须以 "qwen" 开头
function validateQuestionBankFilename(originalName) {
    const baseName = path.basename(originalName || '').replace(/\.json$/i, '');
    if (!baseName.toLowerCase().startsWith('qwen')) {
        return {
            valid: false,
            reason: `文件名校验失败：题库文件必须以"qwen"开头，当前文件名："${originalName}"。\n` +
                    `请确认上传的是题库 JSON（data/exams 下的"qwen*.json"），而非知识点 JSON（data/docs 下的"专题*.json"）。`
        };
    }
    return { valid: true };
}

// 第二级：JSON 结构必须符合题库格式（包含 exam_info 或 sections/questions 数组）
function validateQuestionBankJsonStructure(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
        return { valid: false, reason: 'JSON 结构校验失败：题库 JSON 必须是一个对象（Object），不能是数组或基本类型。' };
    }
    // 检查是否误传了知识点 JSON
    const looksLikeKnowledge = !!(
        typeof json['专题'] === 'string' &&
        (json['考点体系'] || json['命题分析'])
    );
    if (looksLikeKnowledge) {
        return {
            valid: false,
            reason: 'JSON 结构校验失败：该文件看起来是知识点 JSON（包含 "专题"+"考点体系"/"命题分析"），不是题库 JSON。\n' +
                    '请将此文件上传到"上传 JSON 生成知识库"入口。'
        };
    }
    const bank = json.bank || json.questionBank || json;
    const hasExamInfo = bank.exam_info || bank.examInfo;
    const hasSections = Array.isArray(bank.sections) && bank.sections.length > 0;
    const hasQuestions = Array.isArray(bank.questions) && bank.questions.length > 0;
    const hasItems = Array.isArray(bank.items) && bank.items.length > 0;
    if (!hasExamInfo && !hasSections && !hasQuestions && !hasItems) {
        return {
            valid: false,
            reason: 'JSON 结构校验失败：题库 JSON 必须包含 exam_info 字段，或 sections/questions/items 数组之一。\n' +
                    `当前仅有字段：${Object.keys(json).join(', ')}`
        };
    }
    return { valid: true };
}

router.post('/import-json', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'No JSON file uploaded' });

    try {
        // 修复中文文件名编码
        file.originalname = decodeFilename(file.originalname);

        // ── 第一级防御：文件名校验 ──
        const filenameCheck = validateQuestionBankFilename(file.originalname);
        if (!filenameCheck.valid) {
            return res.status(400).json({ success: false, error: filenameCheck.reason });
        }

        let payload;
        try {
            const raw = fs.readFileSync(file.path, 'utf-8');
            payload = JSON.parse(raw);
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                error: `JSON 解析失败：${parseError.message}。请确认上传的是合法 JSON 文件。`
            });
        }

        // ── 第二级防御：JSON 结构校验 ──
        const structureCheck = validateQuestionBankJsonStructure(payload);
        if (!structureCheck.valid) {
            return res.status(400).json({ success: false, error: structureCheck.reason });
        }

        const bank = normalizeQuestionBankPayload(payload, file.originalname);

        if (!bank.title || bank.questions.length === 0) {
            return res.status(400).json({ success: false, error: '题库 JSON 缺少 title 或 questions' });
        }

        const { saveParsedBank } = require('../services/saveParsedBank');
        const result = await saveParsedBank({ dbFile: DB_PATH, bank });

        res.json({
            success: true,
            bankId: bank.paperId,
            title: bank.title,
            totalQuestions: bank.questions.length,
            jsonPath: path.relative(path.join(__dirname, '../..'), result.jsonPath).replace(/\\/g, '/')
        });
    } catch (error) {
        console.error('import question bank json error:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
});

async function loadBankFromDb(db, bankId) {
    const bank = await db.get(
        `SELECT id, title, source_title, subject_id, version_id, total_questions, source_path,
                source_format, paper_type, year, updated_at
         FROM question_banks
         WHERE id = ?`,
        [bankId]
    );

    if (!bank) return null;

    const questions = await db.all(
        `SELECT id, number, original_number, type, content, source_answer, final_answer,
                my_answer, peer_answers, ai_answers, discussion, analysis, score, difficulty,
                page_number, parse_confidence, needs_review, source
         FROM questions
         WHERE bank_id = ?
         ORDER BY number ASC, original_number ASC`,
        [bank.id]
    );

    return {
        paperId: bank.id,
        id: bank.id,
        title: bank.title,
        sourceTitle: bank.source_title || bank.title,
        subject: bank.subject_id,
        version: bank.version_id,
        totalQuestions: bank.total_questions || questions.length,
        sourcePath: bank.source_path,
        sourceFormat: bank.source_format,
        paperType: bank.paper_type,
        year: bank.year,
        updatedAt: bank.updated_at,
        questions: questions.map((question, index) => ({
            id: question.original_number || `q${index + 1}`,
            dbId: question.id,
            number: question.number || index + 1,
            originalNumber: question.original_number,
            type: question.type,
            content: question.content,
            sourceAnswer: question.source_answer || '',
            finalAnswer: question.final_answer || '',
            myAnswer: question.my_answer || '',
            peerAnswers: parseJsonField(question.peer_answers, {}),
            aiAnswers: parseJsonField(question.ai_answers, {}),
            discussion: question.discussion || '',
            analysis: question.analysis || '',
            score: question.score,
            difficulty: question.difficulty,
            pageNumber: question.page_number,
            parseConfidence: question.parse_confidence,
            needsReview: Boolean(question.needs_review),
            source: question.source
        }))
    };
}

function readBankJsonById(id) {
    const directPath = path.join(BANKS_DIR, `${id}_question_bank.json`);
    if (fs.existsSync(directPath)) {
        return JSON.parse(fs.readFileSync(directPath, 'utf-8'));
    }

    const files = fs.readdirSync(BANKS_DIR).filter(file => file.endsWith('_question_bank.json'));
    for (const file of files) {
        const filePath = path.join(BANKS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data.paperId === id || data.id === id) {
            return data;
        }
    }

    return null;
}

function scoreTitleMatch(candidate, title) {
    if (!title) return 10;
    const target = normalizeTitle(title);
    const candidateTitle = normalizeTitle(candidate.title || candidate.source_title || candidate.sourceTitle || '');
    const candidateSource = normalizeTitle(candidate.source_title || candidate.sourceTitle || '');

    if (candidateTitle === target || candidateSource === target) return 100;
    if (candidateTitle.includes(target) || target.includes(candidateTitle)) return 70;
    if (candidateSource.includes(target) || target.includes(candidateSource)) return 60;
    return 0;
}

async function findBestBankInDb(db, subject, title) {
    const params = [];
    const where = [];
    if (subject) {
        where.push('subject_id = ?');
        params.push(subject);
    }

    const candidates = await db.all(
        `SELECT id, title, source_title, subject_id, version_id
         FROM question_banks
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY updated_at DESC`
        ,
        params
    );

    let best = null;
    let bestScore = 0;
    for (const candidate of candidates) {
        const score = scoreTitleMatch(candidate, title);
        if (score > bestScore) {
            best = candidate;
            bestScore = score;
        }
    }

    return best && bestScore > 0 ? loadBankFromDb(db, best.id) : null;
}

// 获取所有题库列表（从数据库读取）
router.get('/list', async (req, res) => {
    try {
        const db = await openDb();
        
        const banks = await db.all(
            `SELECT id, title, subject_id as subject, version_id as version, total_questions as totalQuestions, year 
             FROM question_banks 
             ORDER BY id ASC`
        );
        
        await db.close();
        
        res.json({ success: true, banks: banks });
    } catch (error) {
        console.error('获取题库列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 搜索题库（优先 SQLite，JSON 只作为历史备份兜底）
router.get('/search', async (req, res) => {
    const { subject, title } = req.query;
    
    console.log('搜索参数:', { subject, title });
    
    if (!subject && !title) {
        return res.status(400).json({ success: false, error: '缺少搜索参数' });
    }
    
    try {
        const db = await openDb();
        const dbMatch = await findBestBankInDb(db, subject, title);
        await db.close();

        if (dbMatch) {
            console.log('数据库匹配成功:', dbMatch.title);
            return res.json({ success: true, bank: dbMatch });
        }

        const files = fs.readdirSync(BANKS_DIR);
        let bestMatch = null;
        let bestScore = 0;
        
        for (const file of files) {
            if (!file.endsWith('_question_bank.json')) continue;
            
            const filePath = path.join(BANKS_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            // 学科必须匹配
            if (subject && data.subject !== subject) continue;
            const score = Math.max(scoreTitleMatch(data, title), file.includes(String(title || '').replace(/\s/g, '')) ? 30 : 0);
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = data;
            }
        }
        
        if (bestMatch) {
            console.log('匹配成功:', bestMatch.title);
            res.json({ success: true, bank: bestMatch });
        } else {
            console.log('未找到匹配的题库');
            res.json({ success: true, bank: null });
        }
    } catch (error) {
        console.error('搜索失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取单个题库（优先 SQLite，JSON 只作为历史备份兜底）
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const db = await openDb();
        const bank = await loadBankFromDb(db, id);
        await db.close();

        if (bank) {
            return res.json({ success: true, bank });
        }

        const data = readBankJsonById(id);
        if (!data) {
            return res.status(404).json({ success: false, error: '题库不存在' });
        }
        res.json({ success: true, bank: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 保存题库（同时保存到数据库）
router.post('/save', async (req, res) => {
    const { paperId, title, sourceTitle, subject, version, knowledgePoints, questions, sourcePath: reqSourcePath, sourceFormat, paperType } = req.body;

    if (!paperId || !title) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    try {
        const { saveParsedBank } = require('../services/saveParsedBank');
        const bank = {
            paperId,
            title,
            sourceTitle: sourceTitle || title,
            subject: subject || null,
            version: version || null,
            sourcePath: reqSourcePath || '',
            sourceFormat: sourceFormat || '',
            paperType: paperType || '',
            knowledgePoints: knowledgePoints || [],
            questions: questions || []
        };

        await saveParsedBank({ dbFile: DB_PATH, bank });

        res.json({ success: true, message: '保存成功' });
    } catch (error) {
        console.error('保存失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除单个题库（同步清理 SQLite 与 JSON 备份）
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const db = await openDb();
        const bank = await db.get(`SELECT source_path FROM question_banks WHERE id = ?`, [id]);
        await db.run(
            `DELETE FROM question_assets
             WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)`,
            [id]
        );
        await db.run(
            `DELETE FROM question_knowledge_points
             WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)`,
            [id]
        );
        await db.run(`DELETE FROM questions WHERE bank_id = ?`, [id]);
        const result = await db.run(`DELETE FROM question_banks WHERE id = ?`, [id]);
        await db.close();

        const candidatePaths = [
            path.join(BANKS_DIR, `${id}_question_bank.json`),
            bank?.source_path ? path.join(__dirname, '../..', bank.source_path) : null
        ].filter(Boolean);

        let deletedJson = false;
        for (const filePath of candidatePaths) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                deletedJson = true;
            }
        }

        // 删除磁盘上的题目资产目录（如果存在）
        try {
            const assetDir = path.join(ASSETS_BASE, id);
            if (fs.existsSync(assetDir)) {
                fs.rmSync(assetDir, { recursive: true, force: true });
            }
        } catch (rmErr) {
            console.warn('删除资产目录失败:', rmErr.message);
        }

        if (result.changes === 0 && !deletedJson) {
            return res.status(404).json({ success: false, error: '题库不存在' });
        }

        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除整个学科的所有题库
router.delete('/subject/:subject', (req, res) => {
    const { subject } = req.params;
    
    try {
        const files = fs.readdirSync(BANKS_DIR);
        let deletedCount = 0;
        
        for (const file of files) {
            if (!file.endsWith('_question_bank.json')) continue;
            
            const filePath = path.join(BANKS_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            if (data.subject === subject) {
                fs.unlinkSync(filePath);
                deletedCount++;
                console.log(`删除题库: ${file}`);
            }
        }
        
        res.json({ 
            success: true, 
            message: `删除了 ${deletedCount} 个题库`,
            deletedCount: deletedCount
        });
    } catch (error) {
        console.error('删除学科失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/update-answer', async (req, res) => {
    const { questionNumber, bankId, sourceAnswer } = req.body;
    
    try {
        const db = await openDb();
        
        // 主要更新：使用 number 而不是 original_number
        let result = await db.run(
            `UPDATE questions SET source_answer = ?, updated_at = datetime('now') 
             WHERE number = ? AND bank_id = ?`,
            [sourceAnswer, questionNumber, bankId]
        );

        // 如果精确匹配失败，尝试模糊匹配 bank_id（兼容可能的前端传短ID）
        if (result.changes === 0) {
            result = await db.run(
                `UPDATE questions SET source_answer = ?, updated_at = datetime('now')
                 WHERE number = ? AND bank_id LIKE ?`,
                [sourceAnswer, questionNumber, `%${bankId}%`]
            );
        }
        
        await db.close();
        
        if (result.changes === 0) {
            return res.json({ success: false, error: '未找到对应题目' });
        }
        
        res.json({ success: true, message: '答案已更新' });
    } catch (error) {
        console.error('更新答案失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
