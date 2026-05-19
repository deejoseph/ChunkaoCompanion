const express = require('express');
const axios = require('axios');
const router = express.Router();

// 测试 API 连接
router.post('/test', async (req, res) => {
    const { api_url, api_key, model_name } = req.body;
    
    console.log('测试 API 连接:', { api_url, model_name });
    
    if (!api_key) {
        return res.status(400).json({ success: false, error: '缺少 API Key' });
    }
    
    try {
        // 构建完整的 API 端点
        let endpoint = api_url;
        if (!endpoint.endsWith('/chat/completions')) {
            endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
        }
        
        const response = await axios.post(
            endpoint,
            {
                model: model_name || 'deepseek-v4-flash',
                messages: [
                    { role: 'user', content: '请回复"连接成功"四个字，不要输出其他内容。' }
                ],
                max_tokens: 50
            },
            {
                headers: {
                    'Authorization': `Bearer ${api_key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        const reply = response.data?.choices?.[0]?.message?.content || '';
        
        if (reply.includes('连接成功')) {
            res.json({ success: true, message: '连接成功' });
        } else {
            res.json({ success: true, message: 'API 连接正常，但响应格式异常' });
        }
    } catch (error) {
        console.error('API 测试失败:', error.message);
        res.json({ 
            success: false, 
            error: error.response?.data?.error?.message || error.message 
        });
    }
});

module.exports = router;