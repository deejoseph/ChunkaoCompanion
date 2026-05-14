const express = require('express');
const cors = require('cors');
const { askAI } = require('./services/ollama');
const docsRouter = require('./routes/docs');
const examsRouter = require('./routes/exams');
const listeningRouter = require('./routes/listening');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ========== 路由注册（必须在 app.listen 之前） ==========
app.use('/api/docs', docsRouter);
app.use('/api/exams', examsRouter);
app.use('/api/listening', listeningRouter);

// AI助教接口
app.post('/api/ai/ask', async (req, res) => {
    const { subject, question } = req.body;
    
    if (!subject || !question) {
        return res.status(400).json({ error: '缺少学科或问题参数' });
    }

    const result = await askAI(subject, question);
    
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
});