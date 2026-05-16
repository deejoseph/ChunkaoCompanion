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

// ========== 语文题型检测和专用提示词 ==========

// 语文不同题型的提示词模板
const CHINESE_PROMPTS = {
    // 古诗文默写
    dictation: `你是一个春考语文助教，专精于古诗文默写批改。严格要求：
1. 输出必须与教材原文完全一致，逐字逐句
2. 不要添加任何解释、标点符号或多余内容
3. 多个答案用空格分隔
4. 如果不确定，输出"不确定"
5. 只输出答案，不要输出题号`,

    // 阅读理解
    reading: `你是一个春考语文助教，专精于阅读理解分析。要求：
1. 分析文章的主旨、结构和写作手法
2. 答案要点明确，分条列出
3. 参考春考答题格式
4. 控制在400字以内`,

    // 作文批改
    essay: `你是一个春考语文助教，专精于作文批改。要求：
1. 从立意、结构、语言、素材四个维度评分
2. 指出优点（2-3点）
3. 指出不足（2-3点）
4. 给出具体修改建议
5. 总体评分（满分70分）`,

    // 基础知识（成语、病句等）
    basic: `你是一个春考语文助教，专精于基础知识。要求：
1. 解释要准确、简洁
2. 举例说明
3. 控制在150字以内`,
    
    // 默认
    default: `你是一个春考语文助教。要求：
1. 分析文本时要点明确，分条列出
2. 答题格式参考春考标准
3. 语言简洁，控制在400字以内`
};

// 根据问题内容自动判断语文题型
function detectChineseQuestionType(question) {
    // 包含填空标记 → 默写题
    if (question.includes('______') || question.includes('____________') || question.includes('。') && question.includes('（') && question.includes('）')) {
        return 'dictation';
    }
    // 包含"作文"、"批改"、"评分" → 作文批改
    if (question.includes('作文') || question.includes('批改') || question.includes('评分')) {
        return 'essay';
    }
    // 包含"阅读"、"文章"、"分析" → 阅读理解
    if (question.includes('阅读') || question.includes('文章') || question.includes('分析')) {
        return 'reading';
    }
    // 包含"成语"、"病句"、"修改" → 基础知识
    if (question.includes('成语') || question.includes('病句')) {
        return 'basic';
    }
    return 'default';
}

// ========== 数学公式处理函数 ==========

function getUserModelPreference(subject, userPreference) {
    if (subject !== 'math') {
        return DEFAULT_MODEL_MAP[subject] || DEFAULT_MODEL_MAP.default;
    }

    const preference = userPreference?.math || 'math_medium';
    console.log('后端接收到的偏好:', preference);
    const config = MODEL_CONFIGS[preference];
    console.log('使用的模型配置:', config);
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
13. 禁止在数字和变量之间插入空格。正确: "2x"，错误: "2 x"`;
}

// ========== 主函数 ==========

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
    console.log(`使用模型: ${modelName} (学科: ${subject})`);
    
    // 构建系统提示词（支持语文题型自动检测）
    let systemPrompt;
    
    if (subject === 'math') {
        systemPrompt = buildMathPrompt();
    } else if (subject === 'chinese') {
        // 自动检测语文题型
        const questionType = detectChineseQuestionType(prompt);
        systemPrompt = CHINESE_PROMPTS[questionType] || CHINESE_PROMPTS.default;
        console.log(`语文题型检测: ${questionType}`);
    } else if (subject === 'english') {
        systemPrompt = `你是一个春考英语助教。要求：
1. 用中文解释语法点和词汇
2. 给出典型例句
3. 帮助理解长难句
4. 控制在400字以内`;
    } else if (subject === 'essay') {
        systemPrompt = `你是一个春考作文助教。要求：
1. 指出优点（1-2点）
2. 指出不足（2-3点）
3. 给出修改建议
4. 总体评分（满分100分）
5. 语言温和鼓励`;
    } else {
        systemPrompt = `你是一个春考助教，请用中文回答学生的问题。`;
    }
    
    const fullPrompt = `${systemPrompt}\n\n学生问题：${prompt}`;

    try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: modelName,
            prompt: fullPrompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.4,
                num_predict: options.max_tokens || 2048
            }
        });

        let answer = response.data.response || '';
        if (subject === 'math') {
            answer = formatMathOutput(answer);
        }

        // 获取显示名称
        let modelDisplayName = modelName;
        if (subject === 'math' && config) {
            modelDisplayName = config.name;
        }

        return {
            success: true,
            model: modelName,
            modelDisplayName: modelDisplayName,
            answer: answer
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