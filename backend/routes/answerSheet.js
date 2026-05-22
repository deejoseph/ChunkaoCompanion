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
    // 严格按空格分割，保留原有格式
    const parts = sourceAnswer.trim().split(/\s+/);
    return parts.filter(a => a.length > 0);
}

// 生成填空题的空格区域
function generateFillBlanks(answers) {
    if (!answers || answers.length === 0) {
        return '<div class="fill-blank-item"><div class="blank-line"></div></div>';
    }
    
    let html = '<div class="fill-blanks-container">';
    
    for (let i = 0; i < answers.length; i++) {
        const blankNumber = answers.length > 1 ? `(${i + 1})` : '';
        html += `
            <div class="fill-blank-item">
                ${blankNumber ? `<div class="blank-number">${blankNumber}</div>` : ''}
                <div class="blank-line"></div>
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
            return res.status(400).send('缺少 bankId 参数\n\n使用方式: ?bankId=你的题库ID');
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
        * { box-sizing: border-box; }
        body { 
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif; 
            padding: 20px; 
            max-width: 800px; 
            margin: 0 auto; 
            background: white;
        }
        h1 { text-align: center; color: #1890ff; margin-bottom: 5px; font-size: 20px; }
        .subtitle { text-align: center; color: #666; margin-bottom: 20px; font-size: 13px; }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 10px 0;
            border-bottom: 1px solid #ddd;
        }
        .info-item {
            font-size: 14px;
        }
        .info-line {
            display: inline-block;
            min-width: 150px;
            border-bottom: 1px solid #333;
            margin-left: 8px;
        }
        .question-table {
            width: 100%;
            border-collapse: collapse;
        }
        .question-table th, .question-table td {
            padding: 15px 10px;
            border-bottom: 1px solid #eee;
            vertical-align: top;
        }
        .question-table th {
            background: #f5f5f5;
            font-weight: bold;
            color: #333;
            width: 70px;
            text-align: center;
        }
        .fill-blanks-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .fill-blank-item {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .blank-number {
            font-size: 12px;
            color: #999;
            min-width: 35px;
        }
        .blank-line {
            flex: 1;
            border-bottom: 1px solid #333;
            height: 30px;
        }
        .choice-options {
            display: flex;
            gap: 25px;
            margin-top: 5px;
            flex-wrap: wrap;
        }
        .choice-option {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
        }
        .type-badge {
            font-size: 11px;
            color: #999;
            margin-left: 8px;
        }
        .print-btn { 
            position: fixed; 
            bottom: 20px; 
            right: 20px; 
            padding: 10px 20px; 
            background: #1890ff; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 14px;
            z-index: 100;
        }
        @media print { 
            .print-btn { display: none; } 
            body { padding: 0; margin: 0; }
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #eee;
            padding-top: 20px;
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
                <td style="text-align: center; vertical-align: middle;">${qNumber}<span class="type-badge">【选择题】</span></td>
                <td>
                    ${generateChoiceOptions(qNumber)}
                    <div style="font-size: 12px; color: #999; margin-top: 8px;">💡 请在对应选项前打 √</div>
                </td>
            </tr>
`;
            } else {
                // 填空题：直接从 source_answer 按空格拆分得到答案数量
                const answers = parseAnswers(q.source_answer);
                const blanksHtml = generateFillBlanks(answers);
                
                html += `
            <tr>
                <td style="text-align: center; vertical-align: middle;">${qNumber}<span class="type-badge">【填空题】</span></td>
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
                // 将标准答案按空格分割，检查每个答案是否在 OCR 文本中
                const correctAnswers = q.source_answer.trim().split(/\s+/);
                let allFound = true;
                for (const ans of correctAnswers) {
                    // 清理答案中的标点符号后再匹配
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

router.get('/generate', async (req, res) => {
    const bankId = req.query.bankId;
    await generateAnswerSheet(bankId, res);
});

router.post('/generate', async (req, res) => {
    const bankId = req.body.bankId;
    await generateAnswerSheet(bankId, res);
});

module.exports = router;