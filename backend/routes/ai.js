const express = require('express');
const axios = require('axios');

const router = express.Router();

const DEFAULT_MODELS = ['qwen2.5:7b', 'qwen2.5:14b', 'glm4:9b'];
const OLLAMA_URL = 'http://localhost:11434/api/generate';

// ========== 辅助函数 ==========

// 清理答案中的题号前缀
function cleanAnswer(answer) {
    if (!answer) return answer;
    // 移除开头的"练习 X："、"第X题"等
    let cleaned = answer.replace(/^练习\s*\d+\s*[：:]\s*/g, '');
    cleaned = cleaned.replace(/^第\s*\d+\s*题\s*[：:]\s*/g, '');
    cleaned = cleaned.replace(/^题目[：:]\s*/g, '');
    cleaned = cleaned.replace(/^最终答案[：:]\s*/g, '');
    // 提取选择题答案（如从"B. ③④②①"中提取"B"）
    const match = cleaned.match(/^([A-D])[\.、\s]/);
    if (match) {
        return match[1];
    }
    return cleaned.trim();
}

// 构建验证提示词
function buildValidationPrompt({ subject, questionType, instruction, question }) {
    const subjectName = { chinese: '语文', math: '数学', english: '英语' }[subject] || subject || '学科';
    const typeName = { fill: '填空题', choice: '选择题', qa: '问答题' }[questionType] || questionType || '题目';
    const fallbackInstruction = `你是上海春考${subjectName}阅卷老师。请按${typeName}要求作答，只输出最终答案，不要解释。多空答案用空格分隔，选择题只输出选项字母。`;

    return `${instruction || fallbackInstruction}

题目：
${question}

最终答案：`;
}

// 调用单个模型
async function askModel(model, question, options = {}) {
    const prompt = buildValidationPrompt({ ...options, question });

    try {
        const response = await axios.post(OLLAMA_URL, {
            model,
            prompt,
            stream: false,
            options: {
                temperature: 0.1,
                num_predict: 512
            }
        }, {
            timeout: 90000
        });

        let answer = String(response.data.response || '');
        answer = cleanAnswer(answer);
        return answer;
    } catch (error) {
        console.error(`${model} validation failed:`, error.message);
        return `错误: ${error.message}`;
    }
}

// 投票得出建议答案
function voteAnswers(answers) {
    const answerValues = Object.values(answers).filter(a => a && !String(a).startsWith('错误'));
    const counts = {};
    answerValues.forEach(answer => {
        counts[answer] = (counts[answer] || 0) + 1;
    });

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const suggestedAnswer = ranked[0]?.[0] || '';
    const maxCount = ranked[0]?.[1] || 0;

    let verdict = 'uncertain';
    if (ranked.length === 1 && suggestedAnswer) {
        verdict = 'correct';
    } else if (maxCount >= 2) {
        verdict = 'maybe_correct';
    } else if (ranked.length > 1) {
        verdict = 'incorrect';
    }

    return { verdict, suggestedAnswer };
}

// ========== AI 验证接口 ==========
router.post('/validate', async (req, res) => {
    const { subject, question, models, questionType, instruction } = req.body;

    if (!question) {
        return res.status(400).json({ success: false, error: '缺少题目内容' });
    }

    const targetModels = Array.isArray(models) && models.length > 0 ? models : DEFAULT_MODELS;
    const answers = {};

    try {
        for (const model of targetModels) {
            console.log(`Validating with model: ${model}`);
            const rawAnswer = await askModel(model, question, { subject, questionType, instruction });
            const cleanedAnswer = cleanAnswer(rawAnswer);
            answers[model] = cleanedAnswer;
            console.log(`  ${model}: ${cleanedAnswer}`);
        }

        const { verdict, suggestedAnswer } = voteAnswers(answers);

        res.json({
            success: true,
            answers,
            suggestedAnswer,
            verdict,
            message: `共 ${targetModels.length} 个模型参与验证`
        });
    } catch (error) {
        console.error('AI validation failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== AI 助教问答接口（非流式） ==========
router.post('/ask', async (req, res) => {
    const { subject, question, model } = req.body;

    if (!question) {
        return res.status(400).json({ success: false, error: '缺少问题内容' });
    }

    const modelName = model || 'qwen2.5:14b';

    try {
        const response = await axios.post(OLLAMA_URL, {
            model: modelName,
            prompt: question,
            stream: false,
            options: {
                temperature: 0.3,
                num_predict: 2048
            }
        });

        const answer = response.data.response || '';

        res.json({
            success: true,
            model: modelName,
            answer: answer
        });
    } catch (error) {
        console.error('AI ask failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== AI 助教流式问答接口 ==========
router.post('/ask/stream', async (req, res) => {
    const { subject, question, model } = req.body;

    if (!question) {
        return res.status(400).json({ error: '缺少问题内容' });
    }

    const modelName = model || 'qwen2.5:14b';

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const response = await axios({
            method: 'POST',
            url: OLLAMA_URL,
            data: {
                model: modelName,
                prompt: question,
                stream: true,
                options: {
                    temperature: 0.3,
                    num_predict: 2048
                }
            },
            responseType: 'stream'
        });

        let fullAnswer = '';

        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const data = JSON.parse(line);
                        const content = data.response || '';
                        if (content) {
                            fullAnswer += content;
                            res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
                        }
                        if (data.done) {
                            res.write(`data: ${JSON.stringify({ content: '', done: true, fullAnswer })}\n\n`);
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        });

        response.data.on('end', () => {
            res.end();
        });

        response.data.on('error', (error) => {
            console.error('Ollama 流错误:', error);
            res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('AI 流式请求失败:', error);
        res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
        res.end();
    }
});

module.exports = router;