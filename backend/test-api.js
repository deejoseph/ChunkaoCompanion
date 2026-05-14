const axios = require('axios');

async function testAI() {
    console.log('\n=== 测试数学AI ===');
    try {
        const mathRes = await axios.post('http://localhost:3001/api/ai/ask', {
            subject: 'math',
            question: '请讲解勾股定理的证明过程'
        });
        console.log(`模型: ${mathRes.data.model}`);
        console.log(`回答: ${mathRes.data.answer.substring(0, 300)}...`);
    } catch (error) {
        console.log('请求失败');
        console.log('错误信息:', error.message);
        if (error.response) {
            console.log('响应状态:', error.response.status);
            console.log('响应数据:', error.response.data);
        }
    }

    console.log('\n=== 测试语文AI ===');
    try {
        const chineseRes = await axios.post('http://localhost:3001/api/ai/ask', {
            subject: 'chinese',
            question: '请分析"落霞与孤鹜齐飞，秋水共长天一色"的意境'
        });
        console.log(`模型: ${chineseRes.data.model}`);
        console.log(`回答: ${chineseRes.data.answer.substring(0, 300)}...`);
    } catch (error) {
        console.log('请求失败');
        console.log('错误信息:', error.message);
        if (error.response) {
            console.log('响应状态:', error.response.status);
            console.log('响应数据:', error.response.data);
        }
    }
}

testAI();