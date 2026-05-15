const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434';

// 模型映射：根据学科自动选择
const MODEL_MAP = {
    math: 'qwen2.5-coder:7b',
    code: 'qwen2.5-coder:7b',
    chinese: 'qwen2.5:7b',
    english: 'qwen2.5:7b',
    essay: 'qwen2.5:7b',
    default: 'qwen2.5:7b'
};

// 格式化数学输出
function formatMathOutput(text) {
    if (!text) return text;
    
    // 1. 将 \(...\) 替换为 $...$
    text = text.replace(/\\\((.*?)\\\)/g, '$$$$1$$');
    
    // 2. 将 \[...\] 替换为 $$...$$
    text = text.replace(/\\\[(.*?)\\\]/g, '$$$$1$$');
    
    // 3. 确保独立公式独占一行
    text = text.replace(/\$\$(.*?)\$\$/g, '\n\n$$$1$$\n\n');
    
    // 4. 将 x_1 格式规范化
    text = text.replace(/_([a-zA-Z0-9]+)/g, '_{$1}');
    
    return text;
}

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
        math: `你是一个春考数学助教。严格要求：
1. 所有行内公式必须用 $...$ 包裹，例如：$x = 1$
2. 所有独立公式必须用 $$...$$ 包裹，独占一行
3. 分数用 $\\frac{分子}{分母}$
4. 根号用 $\\sqrt{表达式}$
5. 极限用 $\\lim_{x \\to a}$
6. 下标用 $x_1$，上标用 $x^2$
7. 禁止使用 \\(...\\) 或 \\[...\\] 格式
8. 公式中的文字说明放在公式外面
9. 最后给出1个典型例题
10. 控制在500字以内`,

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
        
        let answer = response.data.response || '';
        
        // 如果是数学学科，格式化公式
        if (subject === 'math') {
            answer = formatMathOutput(answer);
        }
        
        return {
            success: true,
            model: model,
            answer: answer
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