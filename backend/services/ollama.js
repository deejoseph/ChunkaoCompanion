const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434';

const MODEL_CONFIGS = {
    math_fast: {
        model: 'qwen2-math:1.5b',
        name: '快速模式',
        description: '速度最快，适合普通题型、日常练习'
    },
    math_medium: {
        model: 'qwen2-math:7b',
        name: '中速模式',
        description: '适合疑难题目、代数证明'
    },
    math_balanced: {
        model: 'qwen2.5-coder:7b',
        name: '均衡模式',
        description: '公式排版更稳定，兼顾推理'
    }
};

const DEFAULT_MODEL_MAP = {
    math: 'qwen2-math:7b',
    code: 'qwen2.5-coder:7b',
    chinese: 'qwen2.5:7b',
    english: 'qwen2.5:7b',
    essay: 'qwen2.5:7b',
    default: 'qwen2.5:7b'
};

function getUserModelPreference(subject, userPreference) {
    if (subject !== 'math') {
        return DEFAULT_MODEL_MAP[subject] || DEFAULT_MODEL_MAP.default;
    }

    const preference = userPreference?.math || 'math_medium';
    console.log('后端接收到的偏好:', preference);  // 添加日志
    const config = MODEL_CONFIGS[preference];
    console.log('使用的模型配置:', config);  // 添加日志
    return config ? config.model : MODEL_CONFIGS.math_medium.model;
}

function normalizeMathDelimiters(text) {
    return text
        .replace(/\$\$1\$/g, '$')
        .replace(/\$1\$/g, '$')
        .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$')
        .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$')
        .replace(/\$\$(\d+)/g, '$$$1');
}

function stripFormulaCodeBlocks(text) {
    return text.replace(/```(?:latex|tex|math)?\s*([\s\S]*?)```/gi, (match, content) => {
        return `\n\n${content.trim()}\n\n`;
    });
}

function wrapBareFormulaLines(text) {
    const latexCommandPattern = /\\(?:frac|sqrt|boxed|begin|end|sum|int|lim|sin|cos|tan|log|ln|cdot|times|le|ge|neq|approx|alpha|beta|gamma|theta|pi|triangle|angle|overline|vec|left|right)/;

    return text.split('\n').map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith('$') || trimmed.endsWith('$')) return line;
        if (/^[-*]\s+/.test(trimmed)) return line;
        if (/^\d+[.)、]/.test(trimmed) && !latexCommandPattern.test(trimmed)) return line;

        const hasLatexCommand = latexCommandPattern.test(trimmed);
        const hasMathShape = /[=<>]|[\^_]|\\/.test(trimmed);
        const hasCjk = /[\u4e00-\u9fff]/.test(trimmed);
        const hasChinesePunctuation = /[，。；：！？]/.test(trimmed);
        const isLikelyFormulaLine = hasLatexCommand || (hasMathShape && /[a-zA-Z0-9{}]/.test(trimmed));

        if (isLikelyFormulaLine && !hasCjk && !hasChinesePunctuation) {
            return `$$${trimmed}$$`;
        }

        return line;
    }).join('\n');
}

function formatMathOutput(text) {
    if (!text) return text;

    let output = stripFormulaCodeBlocks(text);
    output = normalizeMathDelimiters(output);
    output = wrapBareFormulaLines(output);

    const dollarCount = (output.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
        output += '$';
    }

    return output
        .replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => `\n\n$$${formula.trim()}$$\n\n`)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function buildMathPrompt() {
    return `你是一个春考数学助教。输出目标是给学生直接阅读的印刷版数学解析。

必须严格遵守：
1. 禁止显示裸 LaTeX 源码。不要直接输出 \\frac、\\sqrt、\\boxed、^、_ 这类未包裹的公式源码。
2. 行内短公式必须写成 $...$，独立公式必须写成 $$...$$。前端会把它们渲染成印刷公式。
3. 不要用 markdown 代码块、反引号、"LaTeX:" 或 "公式源码:" 展示公式。
4. 分数写成 $$\\frac{分子}{分母}$$，根号写成 $$\\sqrt{表达式}$$，最终答案写成 $$\\boxed{答案}$$。
5. 每一步先用中文解释，再给独立公式；复杂公式单独成行，不要挤在中文段落里。
6. 回答里给学生看到的应是排版后的数学表达式，而不是 LaTeX 代码本身。
7. 步骤清楚，控制在 500 字以内。`;
}

async function askAI(subject, prompt, options = {}) {
    console.log('收到的 options:', JSON.stringify(options, null, 2));
    console.log('options.userPreference:', options.userPreference);
    
    const preference = options.userPreference?.math || 'math_medium';
    console.log('解析出的 preference:', preference);
    
    const config = MODEL_CONFIGS[preference];
    console.log('对应的 config:', config);
    
    const modelName = subject === 'math'
        ? (config ? config.model : MODEL_CONFIGS.math_medium.model)
        : (DEFAULT_MODEL_MAP[subject] || DEFAULT_MODEL_MAP.default);
    
    console.log('最终使用的 modelName:', modelName);
    // ... 其余代码
    const systemPrompts = {
        math: buildMathPrompt(),
        chinese: `你是一个春考语文助教。要求：
1. 分析文本时要点明确，分条列出。
2. 答题格式参考春考标准。
3. 语言简洁，控制在 400 字以内。`,
        english: `你是一个春考英语助教。要求：
1. 用中文解释语法点和词汇。
2. 给出典型例句。
3. 帮助学生理解长难句。`,
        essay: `你是一个春考作文助教。要求：
1. 指出优点 1-2 点。
2. 指出不足 2-3 点。
3. 给出修改建议。
4. 给出总体评分，满分 100 分。
5. 语言温和。`
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
                temperature: options.temperature || 0.4,
                num_predict: options.max_tokens || 900
            }
        });

        let answer = response.data.response || '';
        if (subject === 'math') {
            answer = formatMathOutput(answer);
        }

        return {
            success: true,
            model: modelName,
            modelDisplayName: subject === 'math' ? config.name : modelName,
            answer
        };
    } catch (error) {
        console.error('Ollama 调用失败:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = { askAI, MODEL_CONFIGS, formatMathOutput, getUserModelPreference };
