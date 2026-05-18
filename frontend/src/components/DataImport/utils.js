import { SUBJECT_NAMES } from './constants';

// 题型识别
export const detectQuestionType = (content) => {
    if (!content) return 'qa';
    if (/[A-D][.．、)]/.test(content) || /^[A-D]\s*[.．、)]/.test(content)) return 'choice';
    if (/_{2,}|____|（\s*）|\(\s*\)/.test(content)) return 'fill';
    if (/默写|填空|补全/.test(content)) return 'fill';
    return 'qa';
};

// 修复：选择题优先于填空题检测
export const detectSpecificQuestionType = (content) => {
    // 1. 选择题优先检测（选项模式：A. B. C. D. 或 A．B．C．D．）
    if (/[A-D][.．、)]/.test(content) || /^[A-D]\s*[.．、)]/.test(content)) {
        return { type: 'choice', label: '选择题' };
    }
    // 2. 默写题检测
    if (content.includes('默写') || content.includes('补写') || content.includes('名篇') || content.includes('名句')) {
        return { type: 'recite', label: '默写题' };
    }
    // 3. 填空题检测
    if (/_{2,}|____|（\s*）|\(\s*\)/.test(content)) {
        return { type: 'fill', label: '填空题' };
    }
    // 4. 问答题
    return { type: 'qa', label: '问答题' };
};

// 从文件名提取专题名称
export const extractTopicFromFilename = (filename) => {
    if (!filename) return '';
    let name = filename.replace(/\.(pdf|docx)$/i, '');
    name = name.replace(/（教师版）$/, '')
               .replace(/\(教师版\)$/, '')
               .replace(/（学生版）$/, '')
               .replace(/\(学生版\)$/, '')
               .replace(/教师版$/, '')
               .replace(/学生版$/, '')
               .trim();
    return name;
};

// 生成AI参考答案标题
export const makeAIReferenceTitle = (title) => {
    const base = (title || '').trim();
    if (!base) return base;
    if (base.includes('AI参考答案')) return base;
    if (base.includes('教师版')) return base.replace(/教师版(?!.*教师版)/, 'AI参考答案');
    if (base.includes('（教师版）')) return base.replace(/（教师版）(?!.*（教师版）)/, '（AI参考答案）');
    if (base.includes('(教师版)')) return base.replace(/\(教师版\)(?!.*\(教师版\))/, '(AI参考答案)');
    return `${base}（AI参考答案）`;
};

// 生成安全文件名
export const makeSafeFileName = (title) => {
    return makeAIReferenceTitle(title)
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_');
};

// 获取学科标签
export const getSubjectLabel = (actualSubject) => {
    return SUBJECT_NAMES[actualSubject] || actualSubject;
};

// AI建议答案提取（投票）
export const getAISuggestedAnswer = (answers) => {
    const values = Object.values(answers || {})
        .filter(a => a && !String(a).startsWith('错误') && !String(a).startsWith('閿欒'));
    const counts = {};
    values.forEach(answer => {
        counts[answer] = (counts[answer] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
};

// 修正 generatePrecisePrompt - 题型互斥
export const generatePrecisePrompt = (subject, questionType, specificType, topicName, content, subjectLabel) => {
    let prompt = `你是上海春考${subjectLabel}阅卷老师。`;
    
    // 根据题型生成不同的要求（互斥）
    if (specificType === 'choice') {
        prompt += `\n\n这是一道选择题。\n\n【严格要求】\n1. 只输出正确选项字母（如 A、B、C、D）\n2. 不要输出题号、不要输出解释、不要输出其他任何内容\n3. 如果题目有多个小问，按顺序输出字母，用空格分隔`;
    } else if (specificType === 'recite') {
        prompt += `\n\n这是一道名句默写题。\n\n【严格要求】\n1. 必须严格依据原文填写，一个字都不能错\n2. 不要自己创作或改写\n3. 不要添加解释或题号\n4. 只输出答案本身，多个空用空格分隔`;
    } else if (specificType === 'fill') {
        prompt += `\n\n这是一道填空题。\n\n【要求】\n1. 根据上下文填写正确答案\n2. 不要输出多余解释\n3. 只输出答案，多个空用空格分隔`;
    } else {
        prompt += `\n\n这是一道问答题。\n\n【要求】\n1. 只输出标准答案要点\n2. 尽量短句分点\n3. 不要输出解题过程或题号`;
    }
    
    // 学科特殊要求
    if (subject === 'chinese') {
        prompt += `\n\n【语文特别要求】\n- 严格依据原文和语境\n- 默写题必须逐字准确\n- 阅读理解要分析到位`;
    } else if (subject === 'math') {
        prompt += `\n\n【数学特别要求】\n- 先内部推理核算\n- 最终只输出答案\n- 保留必要的数学符号`;
    } else if (subject === 'english') {
        prompt += `\n\n【英语特别要求】\n- 注意语法准确性和搭配恰当性\n- 最终只输出答案本身`;
    }
    
    prompt += `\n\n【题目】\n${content}\n\n请只输出答案：`;
    return prompt;
};

// 获取验证模型列表
export const getValidationModels = (actualSubject) => {
    if (actualSubject === 'chinese') {
        return [
            localStorage.getItem('chinese_model_fast') || 'qwen2.5:7b',
            localStorage.getItem('chinese_model_pro') || 'qwen2.5:14b',
            localStorage.getItem('chinese_model_reference') || 'glm4:9b'
        ];
    }
    if (actualSubject === 'math') {
        return [
            localStorage.getItem('math_model_fast') || 'qwen2.5:7b',
            localStorage.getItem('math_model_pro') || 'qwen2.5:14b',
            localStorage.getItem('math_model_reference') || 'qwen2.5-coder:7b'
        ];
    }
    return ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5-coder:7b'];
};