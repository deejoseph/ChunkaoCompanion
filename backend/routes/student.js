const express = require('express');
const path = require('path');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const DB_PATH = path.join(__dirname, '../../data/knowledge/chunkao.db');

function normalizeWeakKnowledgePoints(items = [], totalWrong = 0) {
    return (Array.isArray(items) ? items : []).map(item => ({
        id: item.id || null,
        name: item.name || '未知知识点',
        wrong_count: Number(item.wrong_count || 0),
        accuracy: typeof item.accuracy === 'number'
            ? item.accuracy
            : (totalWrong > 0
                ? Math.max(0, Math.round(100 * (1 - (Number(item.wrong_count || 0) / totalWrong))))
                : 100)
    }));
}

async function loadWeakPointRecommendations(db, studentId) {
    const profile = await db.get(`SELECT total_wrong FROM student_profile WHERE student_id = ?`, [studentId]);
    const totalWrong = Number(profile?.total_wrong || 0);

    const wrongKnowledge = await db.all(`
        SELECT kp.id, kp.name, COUNT(*) as wrong_count
        FROM student_wrong_knowledge swk
        JOIN knowledge_points kp ON swk.knowledge_point_id = kp.id
        WHERE swk.student_id = ?
        GROUP BY kp.id
        ORDER BY wrong_count DESC
    `, [studentId]);

    const weakPoints = normalizeWeakKnowledgePoints(
        wrongKnowledge.map(w => ({ id: w.id, name: w.name, wrong_count: w.wrong_count })),
        totalWrong
    );

    const knowledgePointIds = weakPoints.map(item => item.id).filter(Boolean);
    let relatedTopics = [];

    if (knowledgePointIds.length > 0) {
        const placeholders = knowledgePointIds.map(() => '?').join(',');
        relatedTopics = await db.all(`
            SELECT DISTINCT
                kp.id AS knowledge_point_id,
                kp.name AS knowledge_point_name,
                t.id AS topic_id,
                t.title AS topic_name,
                t.subject_id,
                t.version_id
            FROM topic_knowledge_points tkp
            JOIN topics t ON t.id = tkp.topic_id
            JOIN knowledge_points kp ON kp.id = tkp.knowledge_point_id
            WHERE kp.id IN (${placeholders})
            ORDER BY t.subject_id, t.title
        `, knowledgePointIds);
    }

    return {
        weakPoints,
        relatedTopics,
        totalWrong
    };
}

async function openDb() {
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

// 获取学生画像统计数据
router.get('/profile', async (req, res) => {
    const studentId = req.user?.id || 'default_user';
    try {
        const db = await openDb();
        let profile = await db.get(
            `SELECT * FROM student_profile WHERE student_id = ?`,
            [studentId]
        );
        await db.close();

        if (!profile) {
            // 如果还没有任何数据，返回默认值
            profile = {
                student_id: studentId,
                total_questions_answered: 0,
                total_correct: 0,
                total_wrong: 0,
                average_score: 0,
                weak_knowledge_points: '[]',
                updated_at: new Date().toISOString()
            };
        }

        // 解析 weak_knowledge_points JSON 字段，并补齐可展示的 accuracy
        let weakPoints = [];
        try {
            weakPoints = JSON.parse(profile.weak_knowledge_points || '[]');
        } catch (e) {
            weakPoints = [];
        }
        weakPoints = normalizeWeakKnowledgePoints(weakPoints, profile.total_wrong || 0);

        // 计算正确率
        const accuracy = profile.total_questions_answered > 0
            ? (profile.total_correct / profile.total_questions_answered) * 100
            : 0;

        res.json({
            success: true,
            data: {
                ...profile,
                accuracy: parseFloat(accuracy.toFixed(2)),
                weak_knowledge_points: weakPoints
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取学生画像中的薄弱知识点及其对应专题
router.get('/weak-points', async (req, res) => {
    const studentId = req.user?.id || 'default_user';
    try {
        const db = await openDb();
        const data = await loadWeakPointRecommendations(db, studentId);
        await db.close();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取答题历史记录（答题卡提交记录）
router.get('/history', async (req, res) => {
    const studentId = req.user?.id || 'default_user';
    try {
        const db = await openDb();
        const sheets = await db.all(`
            SELECT id, bank_id, total_score, max_score, wrong_count, answers, created_at, updated_at
            FROM student_answer_sheets
            WHERE student_id = ?
            ORDER BY created_at DESC
        `, [studentId]);
        await db.close();

        // 为每条记录添加正确率
        const history = sheets.map(sheet => ({
            ...sheet,
            answers: JSON.parse(sheet.answers || '{}'),
            accuracy: sheet.max_score > 0 ? (sheet.total_score / sheet.max_score) * 100 : 0
        }));

        res.json({ success: true, history });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 更新学习时长（预留接口，暂不实现具体表）
router.post('/update-study-time', async (req, res) => {
    const { minutes, date } = req.body; // minutes: 学习分钟数, date: 日期字符串 YYYY-MM-DD
    const studentId = req.user?.id || 'default_user';

    // TODO: 创建 study_sessions 表记录每日学习时长
    // 目前返回提示
    res.json({
        success: false,
        error: '该接口尚未实现，请先创建 study_sessions 表'
    });
});

// 重建学生画像（基于历史答题记录）
router.post('/rebuild-profile', async (req, res) => {
    const studentId = req.user?.id || 'default_user';
    try {
        const db = await openDb();

        // 1. 获取所有答题卡记录
        const sheets = await db.all(`
            SELECT id, bank_id, answers FROM student_answer_sheets WHERE student_id = ?
        `, [studentId]);

        if (sheets.length === 0) {
            return res.json({ success: false, error: '没有答题记录，无法重建画像' });
        }

        // 2. 统计总答题数、正确数、错误数
        let totalQuestions = 0;
        let totalCorrect = 0;
        let totalWrong = 0;
        let totalScoreSum = 0;
        let maxScoreSum = 0;

        for (const sheet of sheets) {
            const answers = JSON.parse(sheet.answers || '{}');
            const questions = await db.all(`SELECT id, score FROM questions WHERE bank_id = ?`, [sheet.bank_id]);
            let sheetTotalScore = 0;
            let sheetMaxScore = 0;
            let sheetCorrect = 0;
            for (const q of questions) {
                const userMark = answers[q.id];
                const score = q.score || 0;
                sheetMaxScore += score;
                if (userMark === 'correct') {
                    sheetTotalScore += score;
                    sheetCorrect++;
                } else if (userMark === 'wrong') {
                    totalWrong++;
                }
                totalQuestions++;
            }
            totalCorrect += sheetCorrect;
            totalScoreSum += sheetTotalScore;
            maxScoreSum += sheetMaxScore;
        }

        const averageScore = totalQuestions > 0 ? (totalScoreSum / totalQuestions) : 0;
        const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

        // 3. 聚合薄弱知识点（从 student_wrong_knowledge 表统计每个知识点的错误次数）
        const wrongKnowledge = await db.all(`
            SELECT kp.id, kp.name, COUNT(*) as wrong_count
            FROM student_wrong_knowledge swk
            JOIN knowledge_points kp ON swk.knowledge_point_id = kp.id
            WHERE swk.student_id = ?
            GROUP BY kp.id
            ORDER BY wrong_count DESC
        `, [studentId]);

        // 还需要每个知识点总出现次数（正确+错误），这里简单起见，直接用错误次数作为薄弱度权重
        // 更精确的做法：统计每个知识点被考察的总次数，然后计算错误率
        // 但当前 student_wrong_knowledge 只记录了错误的，没有记录正确的，所以只能显示错误次数最多的几个知识点作为薄弱点
        const weakPoints = normalizeWeakKnowledgePoints(
            wrongKnowledge.slice(0, 10).map(w => ({
                id: w.id,
                name: w.name,
                wrong_count: w.wrong_count
            })),
            totalWrong
        );

        // 4. 更新或插入 student_profile
        const now = new Date().toISOString();
        await db.run(`
            INSERT OR REPLACE INTO student_profile 
            (student_id, total_questions_answered, total_correct, total_wrong, average_score, weak_knowledge_points, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [studentId, totalQuestions, totalCorrect, totalWrong, averageScore, JSON.stringify(weakPoints), now]);

        await db.close();

        res.json({
            success: true,
            message: '画像重建成功',
            data: { totalQuestions, totalCorrect, totalWrong, averageScore, accuracy, weakPoints }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;