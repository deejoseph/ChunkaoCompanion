const express = require('express');
const axios = require('axios');

const router = express.Router();

const DEFAULT_MODELS = ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5-coder:7b'];
const OLLAMA_URL = 'http://localhost:11434/api/generate';

function buildValidationPrompt({ subject, questionType, instruction, question }) {
    const subjectName = { chinese: '语文', math: '数学', english: '英语' }[subject] || subject || '学科';
    const typeName = { fill: '填空题', choice: '选择题', qa: '问答题' }[questionType] || questionType || '题目';
    const fallbackInstruction = `你是上海春考${subjectName}阅卷老师。请按${typeName}要求作答，只输出最终答案，不要解释。多空答案用空格分隔，选择题只输出选项字母。`;

    return `${instruction || fallbackInstruction}

题目：
${question}

最终答案：`;
}

async function askModel(model, question, options = {}) {
    const prompt = buildValidationPrompt({ ...options, question });

    try {
        const response = await axios.post(OLLAMA_URL, {
            model,
            prompt,
            stream: false,
            options: {
                temperature: 0.1,
                num_predict: 180
            }
        }, {
            timeout: 90000
        });

        return String(response.data.response || '')
            .replace(/^(最终答案|答案)\s*[：:]\s*/i, '')
            .trim();
    } catch (error) {
        console.error(`${model} validation failed:`, error.message);
        return `错误: ${error.message}`;
    }
}

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
            answers[model] = await askModel(model, question, { subject, questionType, instruction });
            console.log(`  ${model}: ${answers[model]}`);
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

// 在返回答案之前，清理掉"练习 X："等前缀
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

// 在验证接口中，对每个模型的答案调用 cleanAnswer
router.post('/validate', async (req, res) => {
    // ... 获取各模型答案
    
    const cleanedAnswers = {};
    for (const [model, answer] of Object.entries(answers)) {
        cleanedAnswers[model] = cleanAnswer(answer);
    }
    
    const suggestedAnswer = getSuggestedAnswer(cleanedAnswers);
    
    res.json({
        success: true,
        answers: cleanedAnswers,
        suggestedAnswer: suggestedAnswer,
        // ...
    });
});

module.exports = router;
