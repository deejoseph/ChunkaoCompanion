const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434';

// 预定义模型配置（3种模式）
const MODEL_CONFIGS = {
    // 快速模式：轻量模型，速度最快
    math_fast: {
        model: 'qwen2-math:1.5b',
        name: '⚡ 快速模式',
        description: '速度最快(5-10秒)，适合普通题型、日常练习'
    },
    // 中速模式：数学专用7B，准确率高
    math_medium: {
        model: 'qwen2-math:7b',
        name: '🚀 中速模式',
        description: '速度中等(20-30秒)，适合疑难题目、代数证明'
    },
    // 均衡模式：通用模型，公式美观
    math_balanced: {
        model: 'qwen2.5-coder:7b',
        name: '🎨 均衡模式',
        description: '速度较慢(40-60秒)，公式美观，兼顾推理'
    }
};

// 默认数学模型（推荐中速）
const DEFAULT_MODEL_MAP = {
    math: 'qwen2-math:7b',
    code: 'qwen2.5-coder:7b',
    chinese: 'qwen2.5:7b',
    english: 'qwen2.5:7b',
    essay: 'qwen2.5:7b',
    default: 'qwen2.5:7b'
};

// 获取用户选择的模型
function getUserModelPreference(subject, userPreference) {
    if (subject !== 'math') {
        return DEFAULT_MODEL_MAP[subject] || DEFAULT_MODEL_MAP.default;
    }
    
    const preference = userPreference?.math || 'math_medium';
    const config = MODEL_CONFIGS[preference];
    return config ? config.model : MODEL_CONFIGS.math_medium.model;
}

function formatMathOutput(text) {
    if (!text) return text;
    
    // 1. 修复常见的 $$1$ 错误
    text = text.replace(/\$\$1\$/g, '$');
    text = text.replace(/\$1\$/g, '$');
    
    // 2. 确保行内公式用 $...$
    text = text.replace(/\\\((.*?)\\\)/g, '$$$1$');
    
    // 3. 确保独立公式用 $$...$$
    text = text.replace(/\\\[(.*?)\\\]/g, '$$$$$1$$');
    
    // 4. 修复 $$ 后面跟数字的问题
    text = text.replace(/\$\$(\d+)/g, '$$$1');
    
    // 5. 将不完整的 $ 补全
    let dollarCount = (text.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
        text = text + '$';
    }
    
    // 6. 美化：将 $$...$$ 内的内容适当换行
    text = text.replace(/\$\$(.*?)\$\$/g, '\n\n$$$1$$\n\n');
    
    return text;
}

async function askAI(subject, prompt, options = {}) {
    // 获取用户选择的模型偏好
    const preference = options.userPreference?.math || 'math_medium';
    const config = MODEL_CONFIGS[preference];
    const modelName = config ? config.model : MODEL_CONFIGS.math_medium.model;
    const modelDisplayName = config ? config.name : '中速模式';
    
    const systemPrompts = {
        math: `你是一个春考数学助教。要求：
1. 输出必须使用标准LaTeX格式
2. 行内公式用 $...$，独立公式用 $$...$$
3. 分数用 \\frac{分子}{分母}，根号用 \\sqrt{表达式}
4. 步骤清晰，每步换行
5. 最后答案用 \\boxed{答案} 框出
6. 控制在500字以内`,

        chinese: `你是一个春考语文助教。要求：
1. 分析文本时要点明确，分条列出
2. 答题格式参考春考标准
3. 语言简洁，控制在400字以内`,

        english: `你是一个春考英语助教。要求：
1. 用中文解释语法点和词汇
2. 给出典型例句
3. 帮助理解长难句`,

        essay: `你是一个春考作文助教。要求：
1. 指出优点（1-2点）
2. 指出不足（2-3点）
3. 给出修改建议
4. 总体评分（满分100分）
5. 语言温和鼓励`
    };

    const systemPrompt = systemPrompts[subject] || systemPrompts.chinese;
    const fullPrompt = `${systemPrompt}\n\n学生问题：${prompt}`;
    
    console.log(`使用模型: ${modelName} (学科: ${subject})`);

    try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: modelName,
            prompt: fullPrompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.6,
                max_tokens: options.max_tokens || 800
            }
        });
        
        let answer = response.data.response || '';
        
        if (subject === 'math') {
            answer = formatMathOutput(answer);
        }
        
        return {
            success: true,
            model: modelName,
            modelDisplayName: config.name,  // 如 "🚀 中速模式"
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

module.exports = { askAI, MODEL_CONFIGS };