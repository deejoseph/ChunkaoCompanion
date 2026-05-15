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

    let output = text;

    // 1. 修复每个字母之间被插入空格的问题
    // 将 "a x^2" 修复为 "ax^2"
    output = output.replace(/([a-zA-Z])\s+([a-zA-Z0-9])/g, '$1$2');
    output = output.replace(/([a-zA-Z0-9])\s+([=+\-*/^])/g, '$1$2');
    output = output.replace(/([=+\-*/^])\s+([a-zA-Z0-9])/g, '$1$2');
    
    // 2. 修复数字和变量之间的空格
    output = output.replace(/(\d)\s+([a-zA-Z])/g, '$1$2');
    output = output.replace(/([a-zA-Z])\s+(\d)/g, '$1$2');
    
    // 3. 修复 "x $ =" 为 "$x =$"
    output = output.replace(/([a-zA-Z0-9])\s*\$([^$])/g, '$$$1$2');
    output = output.replace(/\$([^$])\s*([a-zA-Z0-9])/g, '$$$1$2');
    
    // 4. 移除公式内部的孤立空格
    output = output.replace(/\$([^$]+?)\s+([^$]+?)\$/g, '$$$1$2$');
    
    // 5. 修复不完整的美元符号对
    output = output.replace(/([^$])\$([^$])/g, '$1$$2');
    
    // 6. 移除 markdown 代码块
    output = output.replace(/```(?:latex|tex|math)?\s*([\s\S]*?)```/gi, (match, content) => {
        return `\n\n${content.trim()}\n\n`;
    });

    // 7. 修复 $$1$ 这种错误格式
    output = output.replace(/\$\$1\$/g, '$');
    output = output.replace(/\$1\$/g, '$');
    output = output.replace(/\${\$1}\$/g, '$');

    // 8. 转换 \(...\) 和 \[...\] 为标准格式
    output = output.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$');
    output = output.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$');

    // 9. 修复 $$后跟数字的问题
    output = output.replace(/\$\$(\d+)/g, '$$$1');

    // 10. 识别未包裹的 LaTeX 命令并自动包裹
    const lines = output.split('\n');
    const wrapped = lines.map(line => {
        let trimmed = line.trim();
        
        if (trimmed.startsWith('$') && trimmed.endsWith('$')) return line;
        if (trimmed.startsWith('```')) return line;
        if (trimmed.length === 0) return line;
        
        const latexPattern = /\\(?:frac|sqrt|boxed|begin|end|sum|int|lim|sin|cos|tan|log|ln|cdot|times|le|ge|neq|approx|alpha|beta|gamma|theta|pi|triangle|angle|overline|vec|left|right|partial|infty|Rightarrow|rightarrow|Leftarrow|leftarrow|mapsto|forall|exists|in|subset|subseteq|cup|cap|land|lor|lnot|dots|cdots|vdots|ddots)/;
        const mathSymbolPattern = /[=<>+\-*/^_{}]|(\d+[a-zA-Z])|([a-zA-Z]\d+)/;
        
        const hasLatex = latexPattern.test(trimmed);
        const hasMathSymbols = mathSymbolPattern.test(trimmed);
        const hasNoChinese = !/[\u4e00-\u9fff]/.test(trimmed);
        
        if ((hasLatex || hasMathSymbols) && hasNoChinese && trimmed.length > 1) {
            if (!trimmed.startsWith('$')) {
                return `$${trimmed}$`;
            }
        }
        
        if (trimmed.includes('\\begin{aligned}') || trimmed.includes('\\begin{cases}')) {
            if (!trimmed.startsWith('$$')) {
                return `$$${trimmed}$$`;
            }
        }
        
        return line;
    });
    output = wrapped.join('\n');

    // 11. 修复不配对的美元符号
    let dollarCount = (output.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
        output = output + '$';
    }

    // 12. 清理多余空行
    output = output.replace(/\n{3,}/g, '\n\n');
    output = output.replace(/\$\$\s*\$\$/g, '');
    output = output.replace(/\$\$?\s*\\boxed\{([^}]+)\}\s*\$?\$?/g, '$$\\boxed{$1}$$');

    return output.trim();
}

function buildMathPrompt() {
    return `你是一个春考数学助教，必须使用中文输出所有解释和说明。输出目标是给学生直接阅读的印刷版数学解析。

【必须遵守】：
1. 所有解释、步骤说明必须用中文。
2. 所有数学表达式必须用 $ 或 $$ 包裹。
   - 行内短公式用 $...$，例如：$x = 1$
   - 独立公式用 $$...$$，例如：$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
3. 禁止输出未包裹的 LaTeX 源码，如 \\frac、\\sqrt、^、_ 等必须写在 $ 或 $$ 内部。
4. 不要输出 "$$1$" 这种错误格式。
5. 不要使用 markdown 代码块展示公式。
6. 分数写法：$$\\frac{分子}{分母}$$
7. 根号写法：$$\\sqrt{表达式}$$
8. 最终答案写法：$$\\boxed{答案}$$
9. 复杂公式单独成行，不要挤在中文段落里。
10. 步骤说明用中文，每步换行。
11. 输出长度不限，确保完整推导。
12. 禁止在字母之间插入空格。正确: "ax^2"，错误: "a x^2"
13. 禁止在数字和变量之间插入空格。正确: "2x"，错误: "2 x"
14. 所有解释用中文。
15. 公式用 $ 或 $$ 包裹。`;
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
                num_predict: options.max_tokens || 2048  // 从 900 增加到 2048
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
