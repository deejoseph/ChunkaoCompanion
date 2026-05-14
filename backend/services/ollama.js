const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434';

// 模型映射：根据学科自动选择
const MODEL_MAP = {
    math: 'qwen2.5-coder:7b',      // 数学
    code: 'qwen2.5-coder:7b',      // 代码/题目生成
    chinese: 'qwen2.5:7b',         // 语文
    english: 'qwen2.5:7b',         // 英语
    essay: 'qwen2.5:7b',           // 作文批改
    default: 'qwen2.5:7b'
};

/**
 * 调用Ollama生成回答
 * @param {string} subject - 学科 (math/chinese/english/essay)
 * @param {string} prompt - 用户问题
 * @param {object} options - 可选参数 (temperature, max_tokens)
 */
async function askAI(subject, prompt, options = {}) {
    const model = MODEL_MAP[subject] || MODEL_MAP.default;
    
    // 根据学科定制系统提示词
    const systemPrompts = {
        math: `你是一个春考数学助教。要求：
1. 数学知识点必须包含推导过程，步骤清晰
2. 使用LaTeX格式输出公式，必须使用以下格式：
   - 行内公式用 $...$（不要用\\(...\\)）
   - 独立公式用 $$...$$（不要用\\[...\\]）
3. 分数用 \\frac{分子}{分母}
4. 极限用 \\lim_{x \\to a}
5. 平方根用 \\sqrt{}
6. 不要使用 \\nabla 或非标准符号
7. 最后给出1个典型例题和解题思路
8. 控制在500字以内`,

        chinese: `你是一个春考语文助教。要求：
1. 分析文本时要点明确，分条列出
2. 答题格式参考春考标准
3. 语言简洁，控制在400字以内
4. 不要使用LaTeX公式`,

        english: `你是一个春考英语助教。要求：
1. 用中文解释语法点和词汇
2. 给出典型例句
3. 帮助理解长难句
4. 不要使用LaTeX公式`,

        essay: `你是一个春考作文助教。要求：
1. 指出优点（1-2点）
2. 指出不足（2-3点）
3. 给出修改建议
4. 总体评分（满分100分）
5. 语言温和鼓励
6. 不要使用LaTeX公式`
    };

    const systemPrompt = systemPrompts[subject] || systemPrompts.chinese;
    const fullPrompt = `${systemPrompt}\n\n学生问题：${prompt}`;

    try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: model,
            prompt: fullPrompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.6,
                max_tokens: options.max_tokens || 800
            }
        });
        return {
            success: true,
            model: model,
            answer: response.data.response
        };
    } catch (error) {
        console.error('Ollama调用失败:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = { askAI };