const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function saveParsedBank({ dbFile, bank }) {
    if (!dbFile) throw new Error('dbFile is required');
    if (!bank || !bank.paperId) throw new Error('bank.paperId is required');

    const BANKS_DIR = path.join(__dirname, '..', '..', 'data', 'question_banks');
    if (!fs.existsSync(BANKS_DIR)) fs.mkdirSync(BANKS_DIR, { recursive: true });

    const db = await open({ filename: dbFile, driver: sqlite3.Database });

    const questions = bank.questions || [];

    await db.run('BEGIN TRANSACTION');
    try {
        await db.run(
            `INSERT OR REPLACE INTO question_banks
             (id, title, source_title, subject_id, version_id, source_path, source_format, paper_type, year, total_questions, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [bank.paperId, bank.title, bank.sourceTitle || bank.title, bank.subject || null, bank.version || null, bank.sourcePath || '', bank.sourceFormat || '', bank.paperType || '', bank.year || null, bank.totalQuestions || (bank.questions || []).length]
        );

        await db.run(
            `DELETE FROM question_assets
             WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)`,
            [bank.paperId]
        );
        await db.run(
            `DELETE FROM question_knowledge_points
             WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)`,
            [bank.paperId]
        );
        await db.run(`DELETE FROM questions WHERE bank_id = ?`, [bank.paperId]);

        const questions = bank.questions || [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const qId = q.id ? String(q.id) : `q${i + 1}`;
            const number = q.number || i + 1;
            const dbQuestionId = `${bank.paperId}_${qId}`;
            await db.run(
                `INSERT OR REPLACE INTO questions
                 (id, bank_id, subject_id, version_id, number, original_number, type, content, source_answer, final_answer, my_answer, peer_answers, ai_answers, discussion, analysis, score, difficulty, page_number, raw_json, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [
                    dbQuestionId,
                    bank.paperId,
                    bank.subject || null,
                    bank.version || null,
                    number,
                    q.originalNumber || q.original_number || qId,
                    q.type || 'qa',
                    q.content || '',
                    q.sourceAnswer || q.answer || '',
                    q.finalAnswer || '',
                    q.myAnswer || '',
                    JSON.stringify(q.peerAnswers || {}),
                    JSON.stringify(q.aiAnswers || {}),
                    q.discussion || '',
                    q.analysis || '',
                    q.score ?? q.points ?? null,
                    q.difficulty || '',
                    q.pageNumber || q.page_number || null,
                    JSON.stringify(q)
                ]
            );

            const images = []
                .concat(q.images || [])
                .concat(q.image ? [q.image] : [])
                .concat(q.imagePath ? [q.imagePath] : [])
                .filter(Boolean);
            for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
                const image = images[imageIndex];
                const imagePath = typeof image === 'string' ? image : (image.filePath || image.path || image.url || '');
                if (!imagePath) continue;
                await db.run(
                    `INSERT OR REPLACE INTO question_assets
                     (id, question_id, asset_type, file_path, page_number, bbox_json, description, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                    [
                        `${dbQuestionId}_image_${imageIndex + 1}`,
                        dbQuestionId,
                        typeof image === 'object' ? (image.assetType || image.type || 'image') : 'image',
                        imagePath,
                        typeof image === 'object' ? (image.pageNumber || image.page_number || null) : null,
                        typeof image === 'object' && image.bbox ? JSON.stringify(image.bbox) : null,
                        typeof image === 'object' ? (image.description || '') : ''
                    ]
                );
            }

            const knowledgeNames = []
                .concat(q.knowledgePoints || [])
                .concat(q.knowledge_points || [])
                .map(item => typeof item === 'string' ? item : (item.name || item.title || item.knowledgePoint || ''))
                .map(item => String(item).trim())
                .filter(Boolean);
            for (const name of knowledgeNames) {
                const kp = await db.get(
                    `SELECT id FROM knowledge_points WHERE subject_id = ? AND name = ?`,
                    [bank.subject || null, name]
                );
                if (!kp) continue;
                await db.run(
                    `INSERT OR REPLACE INTO question_knowledge_points
                     (question_id, knowledge_point_id, confidence, source, note, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                    [dbQuestionId, kp.id, 0.95, 'json-import', '题库 JSON 导入']
                );
            }
        }

        await db.run('COMMIT');
    } catch (err) {
        await db.run('ROLLBACK');
        await db.close();
        throw err;
    }

    await db.close();

    // write json backup
        const out = {
        paperId: bank.paperId,
        title: bank.title,
        sourceTitle: bank.sourceTitle || bank.title,
        subject: bank.subject || null,
        version: bank.version || null,
        sourcePath: bank.sourcePath || '',
        sourceFormat: bank.sourceFormat || '',
        paperType: bank.paperType || '',
        year: bank.year || null,
        knowledgePoints: bank.knowledgePoints || [],
            totalQuestions: questions.length,
            questions: questions.map((q, idx) => ({
            id: q.id ? String(q.id) : `q${idx + 1}`,
            number: q.number || idx + 1,
            originalNumber: q.originalNumber || q.original_number || (q.id ? String(q.id) : `q${idx + 1}`),
            type: q.type || 'qa',
            content: q.content || '',
            sourceAnswer: q.sourceAnswer || q.answer || '',
            myAnswer: q.myAnswer || q.finalAnswer || '',
            peerAnswers: q.peerAnswers || {},
            aiAnswers: q.aiAnswers || {},
            discussion: q.discussion || '',
            finalAnswer: q.finalAnswer || '',
            analysis: q.analysis || '',
            score: q.score ?? q.points ?? null,
            difficulty: q.difficulty || '',
            pageNumber: q.pageNumber || q.page_number || null,
            images: q.images || (q.image ? [q.image] : []),
            knowledgePoints: q.knowledgePoints || q.knowledge_points || []
        }))
    };

    const filePath = path.join(BANKS_DIR, `${bank.paperId}_question_bank.json`);
    fs.writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf-8');

    return { dbFile, jsonPath: filePath };
}

module.exports = { saveParsedBank };
