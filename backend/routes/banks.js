const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// 答案库目录
const BANKS_DIR = path.join(__dirname, '../../data/question_banks');

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

// 获取所有题库列表（从数据库读取）
router.get('/list', async (req, res) => {
    try {
        const db = await open({
            filename: path.join(__dirname, '../../data/knowledge/chunkao.db'),
            driver: sqlite3.Database
        });
        
        const banks = await db.all(
            `SELECT id, title, subject_id as subject, version_id as version, total_questions as totalQuestions 
             FROM question_banks 
             ORDER BY created_at DESC`
        );
        
        await db.close();
        
        res.json({ success: true, banks: banks });
    } catch (error) {
        console.error('获取题库列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 搜索题库（从 JSON 文件读取）
router.get('/search', (req, res) => {
    const { subject, title } = req.query;
    
    console.log('搜索参数:', { subject, title });
    
    if (!subject && !title) {
        return res.status(400).json({ success: false, error: '缺少搜索参数' });
    }
    
    try {
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
            
            let score = 0;
            
            // 标题匹配度计算
            if (title) {
                const normalizedTitle = title
                    .replace(/（教师版）|（学生版）|（复习讲义）|（上海专用）|\(教师版\)|\(学生版\)/g, '')
                    .trim();
                const normalizedDataTitle = data.title
                    .replace(/（教师版）|（学生版）|（AI参考答案）|（复习讲义）|（上海专用）|\(教师版\)|\(学生版\)/g, '')
                    .trim();
                
                if (normalizedDataTitle === normalizedTitle) {
                    score = 100;
                } else if (normalizedDataTitle.includes(normalizedTitle) || normalizedTitle.includes(normalizedDataTitle)) {
                    score = 50;
                } else if (file.includes(title.replace(/\s/g, ''))) {
                    score = 30;
                }
            } else {
                score = 10;
            }
            
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

// 获取单个题库
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const filePath = path.join(BANKS_DIR, `${id}_question_bank.json`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: '题库不存在' });
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        res.json({ success: true, bank: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 保存题库（同时保存到数据库）
router.post('/save', async (req, res) => {
    const { paperId, title, sourceTitle, subject, version, knowledgePoints, questions } = req.body;
    
    if (!paperId || !title) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    try {
        const db = await open({
            filename: path.join(__dirname, '../../data/knowledge/chunkao.db'),
            driver: sqlite3.Database
        });
        
        // 保存或更新 question_banks
        await db.run(
            `INSERT OR REPLACE INTO question_banks 
             (id, title, source_title, subject_id, version_id, total_questions, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [paperId, title, sourceTitle || title, subject, version, questions.length]
        );
        
        // 保存题目
        for (const q of questions) {
            await db.run(
                `INSERT OR REPLACE INTO questions 
                 (id, bank_id, subject_id, version_id, number, original_number, type, content, 
                  source_answer, final_answer, analysis, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [`${paperId}_${q.id}`, paperId, subject, version, 
                 parseInt(q.id.replace('q', '')), q.id, q.type, q.content,
                 q.sourceAnswer, q.finalAnswer || '', q.analysis || '']
            );
        }
        
        await db.close();
        
        // 同时也保存到 JSON 文件作为备份
        const bankData = {
            paperId,
            title,
            subject,
            version,
            knowledgePoints: knowledgePoints || [],
            totalQuestions: questions.length,
            questions: questions
        };
        
        const filePath = path.join(BANKS_DIR, `${paperId}_question_bank.json`);
        fs.writeFileSync(filePath, JSON.stringify(bankData, null, 2), 'utf-8');
        
        res.json({ success: true, message: '保存成功' });
    } catch (error) {
        console.error('保存失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除单个题库
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const filePath = path.join(BANKS_DIR, `${id}_question_bank.json`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: '题库不存在' });
    }
    
    try {
        fs.unlinkSync(filePath);
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

// 更新题目的 source_answer（通过 original_number 查找）
router.post('/update-answer', async (req, res) => {
    const { questionNumber, bankId, sourceAnswer } = req.body;
    
    try {
        const db = await open({
            filename: path.join(__dirname, '../../data/knowledge/chunkao.db'),
            driver: sqlite3.Database
        });
        
        const result = await db.run(
            `UPDATE questions SET source_answer = ?, updated_at = datetime('now') 
             WHERE original_number = ? AND bank_id = ?`,
            [sourceAnswer, questionNumber, bankId]
        );
        
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
