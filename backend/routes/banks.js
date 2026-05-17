const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

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

// 获取所有题库列表
router.get('/list', (req, res) => {
    try {
        const files = fs.readdirSync(BANKS_DIR);
        const banks = files
            .filter(f => f.endsWith('_question_bank.json'))
            .map(f => {
                const filePath = path.join(BANKS_DIR, f);
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                return {
                    id: f.replace('_question_bank.json', ''),
                    title: data.title,
                    subject: data.subject,
                    version: data.version,
                    totalQuestions: data.totalQuestions,
                    file: f
                };
            });
        res.json({ success: true, banks: banks });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 搜索题库（根据学科和专题名称）
router.get('/search', (req, res) => {
    const { subject, title } = req.query;
    
    if (!subject && !title) {
        return res.status(400).json({ success: false, error: '缺少搜索参数' });
    }
    
    try {
        const files = fs.readdirSync(BANKS_DIR);
        let targetFile = null;
        
        for (const file of files) {
            if (!file.endsWith('_question_bank.json')) continue;
            
            const filePath = path.join(BANKS_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            const normalizedDataTitle = normalizeTitle(data.title);
            const normalizedQueryTitle = normalizeTitle(title);
            
            // 按学科和标题匹配
            if (subject && title) {
                if (data.subject === subject && (
                    data.title === title ||
                    normalizedDataTitle === normalizedQueryTitle ||
                    normalizedDataTitle.includes(normalizedQueryTitle) ||
                    normalizedQueryTitle.includes(normalizedDataTitle)
                )) {
                    targetFile = file;
                    break;
                }
            } else if (subject) {
                if (data.subject === subject) {
                    targetFile = file;
                    break;
                }
            } else if (title) {
                if (
                    data.title === title ||
                    normalizedDataTitle === normalizedQueryTitle ||
                    normalizedDataTitle.includes(normalizedQueryTitle) ||
                    normalizedQueryTitle.includes(normalizedDataTitle)
                ) {
                    targetFile = file;
                    break;
                }
            }
        }
        
        if (targetFile) {
            const filePath = path.join(BANKS_DIR, targetFile);
            const content = fs.readFileSync(filePath, 'utf-8');
            const bank = JSON.parse(content);
            res.json({ success: true, bank: bank });
        } else {
            res.json({ success: true, bank: null });
        }
    } catch (error) {
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

// 保存题库
router.post('/save', (req, res) => {
    const { paperId, title, subject, version, knowledgePoints, questions } = req.body;
    
    if (!paperId || !title) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
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
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(bankData, null, 2), 'utf-8');
        res.json({ success: true, message: '保存成功', file: filePath });
    } catch (error) {
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

module.exports = router;
