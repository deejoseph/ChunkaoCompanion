const express = require('express');
const cors = require('cors');
const { askAI } = require('./services/ollama');
const docsRouter = require('./routes/docs');
const examsRouter = require('./routes/exams');
const listeningRouter = require('./routes/listening');
const ocrRouter = require('./routes/ocr');
const aiRouter = require('./routes/ai');
const banksRouter = require('./routes/banks');
const apiConfigRouter = require('./routes/apiConfig');
const whisperRouter = require('./routes/whisper');
const internationalRouter = require('./routes/international');
const knowledgeRouter = require('./routes/knowledge');
const answerSheetRouter = require('./routes/answerSheet');

const app = express();
const PORT = 3001;
const path = require('path');
const studentRouter = require('./routes/student');

// ========== 中间件（必须在路由之前） ==========
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ========== 路由注册 ==========
app.use('/api/answer-sheet', answerSheetRouter);
app.use('/api/whisper', whisperRouter);
app.use('/api/international', internationalRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/docs', docsRouter);
app.use('/api/exams', examsRouter);
app.use('/api/listening', listeningRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/ai', aiRouter);
app.use('/api/banks', banksRouter);
app.use('/api/config', apiConfigRouter);
app.use('/api/student', studentRouter);

// 允许前端访问 analysis 目录下的图表图片
app.use('/analysis', express.static(path.join(__dirname, '../data/analysis')));

// AI助教接口
app.post('/api/ai/ask', async (req, res) => {
    console.log('收到的请求体:', req.body);
    const { subject, question, userPreference } = req.body;
    
    console.log('【DEBUG】userPreference:', userPreference);
    
    if (!subject || !question) {
        return res.status(400).json({ error: '缺少学科或问题参数' });
    }

    const result = await askAI(subject, question, { userPreference });
    
    if (result.success) {
        res.json({
            success: true,
            model: result.model,
            answer: result.answer
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error
        });
    }
});

// 启动超级AI（qwen3.6:27b）接口
app.post('/api/ai/start-super-ai', (req, res) => {
    const { exec } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    
    try {
        const scriptPath = path.join(__dirname, '..', 'start_super_ai.bat');
        
        // 验证脚本存在
        if (!fs.existsSync(scriptPath)) {
            return res.status(500).json({
                success: false,
                error: `脚本不存在: ${scriptPath}`
            });
        }
        
        console.log(`[DEBUG] 启动脚本路径: ${scriptPath}`);
        
        // 在新窗口中启动脚本（使用绝对路径和正确的引号）
        const command = `start "" cmd /k "${scriptPath}"`;
        console.log(`[DEBUG] 执行命令: ${command}`);
        
        exec(command, { 
            cwd: path.dirname(scriptPath),
            shell: true
        }, (error, stdout, stderr) => {
            if (error) {
                console.error('[ERROR] 启动超级AI失败:', error.message);
            } else {
                console.log('[SUCCESS] 超级AI启动命令已发送');
            }
            if (stderr) console.error('[STDERR]', stderr);
        });
        
        res.json({
            success: true,
            message: '超级AI启动中...新窗口正在打开（qwen3.6:27b）',
            note: '首次运行可能需要等待模型下载和加载，请耐心等待'
        });
    } catch (error) {
        console.error('启动超级AI异常:', error);
        res.status(500).json({
            success: false,
            error: '启动超级AI失败：' + error.message
        });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== 启动服务器 ==========
app.listen(PORT, () => {
    console.log(`后端服务运行在 http://localhost:${PORT}`);
    console.log(`AI接口: POST http://localhost:${PORT}/api/ai/ask`);
    console.log(`文档接口: GET http://localhost:${PORT}/api/docs/all-topics`);
    console.log(`真题接口: GET http://localhost:${PORT}/api/exams/papers/english/2026`);
    console.log(`OCR接口: POST http://localhost:${PORT}/api/ocr/recognize`);
    console.log(`AI验证接口: POST http://localhost:${PORT}/api/ai/validate`);
    console.log(`题库接口: POST http://localhost:${PORT}/api/banks/save`);
    console.log(`知识点接口: GET http://localhost:${PORT}/api/knowledge/summary`);
    console.log(`答题卡接口: POST http://localhost:${PORT}/api/answer-sheet/generate`);
});