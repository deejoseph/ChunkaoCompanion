const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

let db;
(async () => {
    try {
        db = await open({
            filename: path.join(__dirname, '../../data/knowledge/chunkao.db'),
            driver: sqlite3.Database
        });
        console.log('答题卡模块: 数据库连接成功');
    } catch (err) {
        console.error('答题卡模块: 数据库连接失败', err);
    }
})();

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '<br>');
}

// 从 source_answer 解析答案列表（严格按空格拆分）
function parseAnswers(sourceAnswer) {
    if (!sourceAnswer) return [];
    const parts = sourceAnswer.trim().split(/\s+/);
    return parts.filter(a => a.length > 0);
}

// 生成填空题的空格区域
function generateFillBlanks(answers) {
    if (!answers || answers.length === 0) {
        return '<div class="fill-blank-item"><div class="blank-line" style="width: 180px;"></div></div>';
    }
    
    let html = '<div class="fill-blanks-container">';
    
    // 根据答案数量动态调整空格宽度
    // 答案越少，空格越宽
    let blankWidth = 180;  // 基础宽度
    if (answers.length >= 5) {
        blankWidth = 140;
    } else if (answers.length >= 3) {
        blankWidth = 160;
    } else {
        blankWidth = 200;
    }
    
    for (let i = 0; i < answers.length; i++) {
        const blankNumber = answers.length > 1 ? `(${i + 1})` : '';
        html += `
            <div class="fill-blank-item">
                ${blankNumber ? `<span class="blank-number">${blankNumber}</span>` : ''}
                <span class="blank-line" style="width: ${blankWidth}px;"></span>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

function generateChoiceOptions(questionNumber) {
    return `
        <div class="choice-options">
            <label class="choice-option"><input type="radio" name="q${questionNumber}" value="A"> A</label>
            <label class="choice-option"><input type="radio" name="q${questionNumber}" value="B"> B</label>
            <label class="choice-option"><input type="radio" name="q${questionNumber}" value="C"> C</label>
            <label class="choice-option"><input type="radio" name="q${questionNumber}" value="D"> D</label>
        </div>
    `;
}

async function generateAnswerSheet(bankId, res) {
    try {
        if (!bankId) {
            return res.status(400).send('缺少 bankId 参数');
        }
        
        console.log('生成答题卡, bankId:', bankId);
        
        const bank = await db.get(`SELECT title FROM question_banks WHERE id = ?`, [bankId]);
        
        const questions = await db.all(
            `SELECT number, type, source_answer
             FROM questions 
             WHERE bank_id = ? 
             ORDER BY number ASC`,
            [bankId]
        );
        
        if (questions.length === 0) {
            return res.status(404).send('未找到题目，bankId: ' + bankId);
        }
        
        const bankTitle = bank ? bank.title.replace('（AI参考答案）', '') : '答题卡';
        
        let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(bankTitle)} - 答题卡</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif; 
            padding: 8px; 
            max-width: 100%;
            background: white;
            font-size: 12px;
        }
        h1 { text-align: center; color: #1890ff; margin: 5px 0; font-size: 16px; }
        .subtitle { text-align: center; color: #666; margin-bottom: 8px; font-size: 10px; }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            padding: 5px 0;
            border-bottom: 1px solid #ddd;
        }
        .info-item {
            font-size: 11px;
        }
        .info-line {
            display: inline-block;
            min-width: 100px;
            border-bottom: 1px solid #333;
            margin-left: 6px;
        }
        .question-table {
            width: 100%;
            border-collapse: collapse;
        }
        .question-table th, .question-table td {
            padding: 5px 4px;
            border: none;
            vertical-align: top;
        }
        .question-table th:first-child {
            width: 35px;
            text-align: center;
        }
        .question-table th:last-child {
            text-align: left;
        }
        .question-table td:first-child {
            width: 35px;
            text-align: center;
            vertical-align: middle;
        }
        .question-table td:last-child {
            text-align: left;
        }
        .question-table th {
            background: #f5f5f5;
            font-weight: bold;
            color: #333;
            font-size: 11px;
        }
        .fill-blanks-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
        }
        .fill-blank-item {
            display: flex;
            align-items: center;
            gap: 3px;
        }
        .blank-number {
            font-size: 10px;
            color: #999;
            min-width: 16px;
        }
        .blank-line {
            border-bottom: 1px solid #333;
            height: 22px;
            display: inline-block;
            min-width: 150px;
        }
        .choice-options {
            display: flex;
            gap: 12px;
            margin-top: 2px;
            flex-wrap: wrap;
        }
        .choice-option {
            display: flex;
            align-items: center;
            gap: 3px;
            font-size: 12px;
        }
        .type-badge {
            font-size: 9px;
            color: #999;
            display: block;
            line-height: 1.2;
        }
        .print-btn { 
            position: fixed; 
            bottom: 10px; 
            right: 10px; 
            padding: 6px 12px; 
            background: #1890ff; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 12px;
            z-index: 100;
        }
        @media print { 
            .print-btn { display: none; } 
            body { padding: 0; margin: 0; }
        }
        .footer {
            margin-top: 15px;
            text-align: center;
            font-size: 9px;
            color: #999;
            border-top: 1px solid #eee;
            padding-top: 8px;
        }
    </style>
</head>
<body>
    <h1>📝 ${escapeHtml(bankTitle)}</h1>
    <div class="subtitle">答题卡</div>
    
    <div class="info-row">
        <div class="info-item">班级：<span class="info-line"></span></div>
        <div class="info-item">姓名：<span class="info-line"></span></div>
        <div class="info-item">学号：<span class="info-line"></span></div>
    </div>
    
    <table class="question-table">
        <thead>
            <tr><th>题号</th><th>答案填写区</th></tr>
        </thead>
        <tbody>
`;
        
        for (let idx = 0; idx < questions.length; idx++) {
            const q = questions[idx];
            const qNumber = q.number || (idx + 1);
            
            if (q.type === 'choice') {
                html += `
            <tr>
                <td style="text-align: center; vertical-align: middle;">
                    ${qNumber}
                    <div class="type-badge">选择</div>
                </td>
                <td>
                    <div class="choice-options">
                        <label class="choice-option"><input type="radio" name="q${qNumber}" value="A"> A</label>
                        <label class="choice-option"><input type="radio" name="q${qNumber}" value="B"> B</label>
                        <label class="choice-option"><input type="radio" name="q${qNumber}" value="C"> C</label>
                        <label class="choice-option"><input type="radio" name="q${qNumber}" value="D"> D</label>
                    </div>
                </td>
            </tr>
`;
            } else {
                const answers = parseAnswers(q.source_answer);
                const blanksHtml = generateFillBlanks(answers);
                
                html += `
            <tr>
                <td style="text-align: center; vertical-align: middle;">
                    ${qNumber}
                    <div class="type-badge">填空</div>
                </td>
                <td>${blanksHtml}</td>
            </tr>
`;
            }
        }
        
        html += `
        </tbody>
    </table>
    
    <div class="footer">
        春考伴学 · AI 智能批改 | 答完后拍照上传即可获得评分
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ 打印答题卡</button>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
        
    } catch (error) {
        console.error('生成答题卡失败:', error);
        res.status(500).send('生成失败: ' + error.message);
    }
}

// ========== 路由：生成答题卡（支持通过 subject + title 查找） ==========
router.get('/generate', async (req, res) => {
    const bankId = req.query.bankId;
    const subject = req.query.subject;
    const title = req.query.title;
    
    let targetBankId = bankId;
    
    // 如果没有直接提供 bankId，通过 subject 和 title 查找
    if (!targetBankId && subject && title) {
        try {
            let cleanTitle = title;
            cleanTitle = cleanTitle.replace(/（教师版）/, '');
            cleanTitle = cleanTitle.replace(/（学生版）/, '');
            cleanTitle = cleanTitle.replace(/（复习讲义）/, '');
            cleanTitle = cleanTitle.replace(/（上海专用）/, '');
            cleanTitle = cleanTitle.trim();
            
            console.log('查找题库: subject=', subject, 'title=', cleanTitle);
            
            const bank = await db.get(
                `SELECT id FROM question_banks 
                 WHERE subject_id = ? AND title LIKE ? 
                 LIMIT 1`,
                [subject, `%${cleanTitle}%`]
            );
            
            if (bank) {
                targetBankId = bank.id;
                console.log('找到题库:', targetBankId);
            } else {
                console.log('未找到匹配的题库');
            }
        } catch (err) {
            console.error('查找题库失败:', err);
        }
    }
    
    if (!targetBankId) {
        return res.status(400).send('缺少 bankId 参数，且未能通过 subject+title 找到匹配的题库\n\n请使用: ?bankId=题库ID 或 ?subject=学科&title=专题名称');
    }
    
    await generateAnswerSheet(targetBankId, res);
});

router.post('/generate', async (req, res) => {
    const bankId = req.body.bankId;
    await generateAnswerSheet(bankId, res);
});

// 答题卡识别与评分
router.post('/scan', upload.single('image'), async (req, res) => {
    const { bankId } = req.body;
    const imageFile = req.file;
    
    if (!bankId) {
        return res.status(400).json({ success: false, error: '缺少 bankId 参数' });
    }
    
    if (!imageFile) {
        return res.status(400).json({ success: false, error: '未上传图片' });
    }
    
    try {
        const formData = new FormData();
        formData.append('image', fs.createReadStream(imageFile.path));
        
        const ocrResponse = await axios.post('http://localhost:3001/api/ocr/recognize-text', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (!ocrResponse.data.success) {
            throw new Error('OCR 识别失败');
        }
        
        const ocrText = ocrResponse.data.text;
        
        const questions = await db.all(
            `SELECT number, type, source_answer 
             FROM questions 
             WHERE bank_id = ? 
             ORDER BY number ASC`,
            [bankId]
        );
        
        const results = questions.map((q) => {
            let userAnswer = null;
            let isCorrect = false;
            
            if (q.source_answer && q.source_answer.trim()) {
                const correctAnswers = q.source_answer.trim().split(/\s+/);
                let allFound = true;
                for (const ans of correctAnswers) {
                    const cleanAns = ans.replace(/[《》·,，、。！？；：""''（）【】]/g, '');
                    if (cleanAns && !ocrText.includes(cleanAns)) {
                        allFound = false;
                        break;
                    }
                }
                isCorrect = allFound && correctAnswers.length > 0;
                if (isCorrect) {
                    userAnswer = q.source_answer;
                }
            }
            
            return {
                number: q.number,
                userAnswer: userAnswer || '未识别',
                correctAnswer: q.source_answer || '无',
                isCorrect,
                score: isCorrect ? 1 : 0
            };
        });
        
        const totalScore = results.reduce((sum, r) => sum + r.score, 0);
        const maxScore = results.length;
        
        if (fs.existsSync(imageFile.path)) {
            fs.unlinkSync(imageFile.path);
        }
        
        res.json({
            success: true,
            data: {
                ocrText: ocrText.substring(0, 500),
                totalScore,
                maxScore,
                percentage: Math.round((totalScore / maxScore) * 100),
                results
            }
        });
        
    } catch (error) {
        console.error('答题卡识别失败:', error);
        if (imageFile && fs.existsSync(imageFile.path)) {
            fs.unlinkSync(imageFile.path);
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;