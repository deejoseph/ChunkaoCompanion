const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3002;

app.use(cors()); // 允许前端跨域请求
app.use(express.json());

// 一个简单的测试接口
app.get('/api/hello', (req, res) => {
    res.json({ message: '你好，这是后端返回的数据！' });
});

// 另一个示例：接收前端发送的名字，返回个性化问候
app.post('/api/greet', (req, res) => {
    const { name } = req.body;
    res.json({ message: `Hello, ${name || '同学'}！后端已经收到你的请求。` });
});

app.listen(PORT, () => {
    console.log(`后端服务运行在 http://localhost:${PORT}`);
});
