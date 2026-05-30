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
             (id, title, source_title, subject_id, version_id, source_path, source_format, paper_type, total_questions, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [bank.paperId, bank.title, bank.sourceTitle || bank.title, bank.subject || null, bank.version || null, bank.sourcePath || '', bank.sourceFormat || '', bank.paperType || '', bank.totalQuestions || (bank.questions || []).length]
        );

        await db.run(`DELETE FROM questions WHERE bank_id = ?`, [bank.paperId]);

        const questions = bank.questions || [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const qId = q.id ? String(q.id) : `q${i + 1}`;
            const number = q.number || i + 1;
            await db.run(
                `INSERT OR REPLACE INTO questions
                 (id, bank_id, subject_id, version_id, number, original_number, type, content, source_answer, final_answer, my_answer, peer_answers, ai_answers, discussion, analysis, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [
                    `${bank.paperId}_${qId}`,
                    bank.paperId,
                    bank.subject || null,
                    bank.version || null,
                    number,
                    qId,
                    q.type || 'qa',
                    q.content || '',
                    q.sourceAnswer || q.answer || '',
                    q.finalAnswer || '',
                    q.myAnswer || '',
                    JSON.stringify(q.peerAnswers || {}),
                    JSON.stringify(q.aiAnswers || {}),
                    q.discussion || '',
                    q.analysis || ''
                ]
            );
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
        knowledgePoints: bank.knowledgePoints || [],
            totalQuestions: questions.length,
            questions: questions.map((q, idx) => ({
            id: q.id ? String(q.id) : `q${idx + 1}`,
            type: q.type || 'qa',
            content: q.content || '',
            sourceAnswer: q.sourceAnswer || q.answer || '',
            myAnswer: q.myAnswer || q.finalAnswer || '',
            peerAnswers: q.peerAnswers || {},
            aiAnswers: q.aiAnswers || {},
            discussion: q.discussion || '',
            finalAnswer: q.finalAnswer || '',
            analysis: q.analysis || ''
        }))
    };

    const filePath = path.join(BANKS_DIR, `${bank.paperId}_question_bank.json`);
    fs.writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf-8');

    return { dbFile, jsonPath: filePath };
}

module.exports = { saveParsedBank };
