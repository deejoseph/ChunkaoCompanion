const express = require('express');
const path = require('path');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../data/knowledge/chunkao.db');

async function openDb() {
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

// 获取某个题库的所有题目（用于答题卡显示）
router.get('/questions/:bankId', async (req, res) => {
    const { bankId } = req.params;
    try {
        const db = await openDb();
        const questions = await db.all(`
            SELECT id, number, content, score, original_number
            FROM questions 
            WHERE bank_id = ?
        `, [bankId]);

        // 自定义排序：支持 "数字" 或 "数字.数字" 格式
        questions.sort((a, b) => {
            const toKey = (str) => {
                if (!str) return [0];
                const parts = String(str).split('.');
                return parts.map(part => {
                    const num = parseInt(part, 10);
                    return isNaN(num) ? 0 : num;
                });
            };
            const aKey = toKey(a.original_number);
            const bKey = toKey(b.original_number);
            for (let i = 0; i < Math.max(aKey.length, bKey.length); i++) {
                const aVal = aKey[i] || 0;
                const bVal = bKey[i] || 0;
                if (aVal !== bVal) return aVal - bVal;
            }
            return 0;
        });
        await db.close();
        const maxScore = questions.reduce((sum, q) => sum + (q.score || 0), 0);
        res.json({ success: true, questions, maxScore });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 提交答题卡批改结果
router.post('/submit', async (req, res) => {
    const { bankId, answers } = req.body;
    const studentId = req.user?.id || 'default_user';
    const sheetId = uuidv4();
    const now = new Date().toISOString();

    try {
        const db = await openDb();
        const questions = await db.all(`
            SELECT id, number, score FROM questions WHERE bank_id = ?
        `, [bankId]);

        let totalScore = 0;
        let maxScore = 0;
        const wrongQuestionIds = [];

        for (const q of questions) {
            const userMark = answers[q.id];
            const score = q.score || 0;
            maxScore += score;
            if (userMark === 'correct') {
                totalScore += score;
            } else if (userMark === 'wrong') {
                wrongQuestionIds.push(q.id);
            }
        }

        await db.run(`
            INSERT INTO student_answer_sheets 
            (id, student_id, bank_id, total_score, max_score, wrong_count, answers, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [sheetId, studentId, bankId, totalScore, maxScore, wrongQuestionIds.length, JSON.stringify(answers), now, now]);

        let wrongMappings = [];
        if (wrongQuestionIds.length > 0) {
            const placeholders = wrongQuestionIds.map(() => '?').join(',');
            // 修正1：去掉 kp.topic_id
            wrongMappings = await db.all(`
                SELECT qkp.question_id, qkp.knowledge_point_id, kp.name
                FROM question_knowledge_points qkp
                JOIN knowledge_points kp ON qkp.knowledge_point_id = kp.id
                WHERE qkp.question_id IN (${placeholders})
            `, wrongQuestionIds);

            for (const mapping of wrongMappings) {
                await db.run(`
                    INSERT INTO student_wrong_knowledge 
                    (id, student_id, question_id, knowledge_point_id, bank_id, sheet_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [uuidv4(), studentId, mapping.question_id, mapping.knowledge_point_id, bankId, sheetId, now]);
            }
        }

        // 更新或创建学生画像
        let profile = await db.get(`SELECT * FROM student_profile WHERE student_id = ?`, [studentId]);
        if (!profile) {
            await db.run(`
                INSERT INTO student_profile (student_id, total_questions_answered, total_correct, total_wrong, average_score, updated_at)
                VALUES (?, 0, 0, 0, 0, ?)
            `, [studentId, now]);
            profile = { total_questions_answered: 0, total_correct: 0, total_wrong: 0 };
        }
        const newTotalQuestions = profile.total_questions_answered + questions.length;
        const newTotalCorrect = profile.total_correct + (questions.length - wrongQuestionIds.length);
        const newTotalWrong = profile.total_wrong + wrongQuestionIds.length;
        const newAvgScore = profile.total_questions_answered === 0 ? totalScore / questions.length : (profile.average_score * profile.total_questions_answered + totalScore) / newTotalQuestions;

        await db.run(`
            UPDATE student_profile 
            SET total_questions_answered = ?, total_correct = ?, total_wrong = ?, average_score = ?, updated_at = ?
            WHERE student_id = ?
        `, [newTotalQuestions, newTotalCorrect, newTotalWrong, newAvgScore, now, studentId]);

        // 获取错题涉及的专题（通过 topic_knowledge_points 关联）
        let topicsList = [];
        if (wrongQuestionIds.length > 0) {
            const placeholders = wrongQuestionIds.map(() => '?').join(',');
            topicsList = await db.all(`
                SELECT DISTINCT t.id, t.title as name
                FROM topics t
                JOIN topic_knowledge_points tkp ON t.id = tkp.topic_id
                JOIN question_knowledge_points qkp ON tkp.knowledge_point_id = qkp.knowledge_point_id
                WHERE qkp.question_id IN (${placeholders})
            `, wrongQuestionIds);
        }

        await db.close();

        res.json({
            success: true,
            sheetId,
            totalScore,
            maxScore,
            wrongCount: wrongQuestionIds.length,
            topics: topicsList,
            wrongKnowledgePoints: wrongMappings.map(m => ({ id: m.knowledge_point_id, name: m.name }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取当前学生的答题历史（默认）
router.get('/history', async (req, res) => {
    const studentId = req.user?.id || 'default_user';
    try {
        const db = await openDb();
        const sheets = await db.all(`
            SELECT * FROM student_answer_sheets 
            WHERE student_id = ? 
            ORDER BY created_at DESC
        `, [studentId]);
        await db.close();
        res.json({ success: true, sheets });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取指定学生的答题历史
router.get('/history/:studentId', async (req, res) => {
    const studentId = req.params.studentId;
    try {
        const db = await openDb();
        const sheets = await db.all(`
            SELECT * FROM student_answer_sheets 
            WHERE student_id = ? 
            ORDER BY created_at DESC
        `, [studentId]);
        await db.close();
        res.json({ success: true, sheets });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;