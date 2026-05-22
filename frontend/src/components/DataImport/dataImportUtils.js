const MODEL_NICKNAMES = {
    'qwen2.5:7b': '小明',
    'qwen2.5:14b': '小红',
    'glm4:9b': '小刚',
    'qwen2.5-coder:7b': '小华',
    'qwen2-math:1.5b': '小智',
    'qwen2-math:7b': '小慧',
    'gemma3:4b': '小美'
};

const MODEL_COLORS = {
    'qwen2.5:7b': '#1890ff',
    'qwen2.5:14b': '#52c41a',
    'glm4:9b': '#722ed1',
    'qwen2.5-coder:7b': '#eb2f96',
    'qwen2-math:1.5b': '#13c2c2',
    'qwen2-math:7b': '#fa8c16',
    'gemma3:4b': '#2f54eb'
};

export const getModelNickname = (model) => MODEL_NICKNAMES[model] || model.split(':')[0];

export const getModelColor = (model) => MODEL_COLORS[model] || '#999';

export const detectQuestionType = (content) => {
    if (!content) return 'qa';
    if (/[A-D][.．、)]/.test(content) || /^[A-D]\s*[.．、)]/.test(content)) return 'choice';
    if (/_{2,}|____|（\s*）|\(\s*\)/.test(content)) return 'fill';
    if (/默写|填空|补全/.test(content)) return 'fill';
    return 'qa';
};

export const detectSpecificQuestionType = (content) => {
    if (/[A-D][.．、)]/.test(content) || /^[A-D]\s*[.．、)]/.test(content)) {
        return { type: 'choice', label: '选择题' };
    }
    if (content.includes('默写') || content.includes('补写') || content.includes('名篇') || content.includes('名句')) {
        return { type: 'recite', label: '默写题' };
    }
    if (content.includes('成语') && (content.includes('使用恰当') || content.includes('运用恰当'))) {
        return { type: 'choice', label: '选择题' };
    }
    if (/_{2,}|____|（\s*）|\(\s*\)/.test(content)) {
        return { type: 'fill', label: '填空题' };
    }
    return { type: 'qa', label: '问答题' };
};

export const extractTopicFromFilename = (filename) => {
    if (!filename) return '';
    return filename
        .replace(/\.(pdf|docx)$/i, '')
        .replace(/（教师版）$/, '')
        .replace(/\(教师版\)$/, '')
        .replace(/（学生版）$/, '')
        .replace(/\(学生版\)$/, '')
        .replace(/教师版$/, '')
        .replace(/学生版$/, '')
        .trim();
};

export const makeAIReferenceTitle = (title) => {
    const base = (title || '').trim();
    if (!base) return base;
    if (base.includes('AI参考答案')) return base;
    if (base.includes('教师版')) return base.replace(/教师版(?!.*教师版)/, 'AI参考答案');
    if (base.includes('（教师版）')) return base.replace(/（教师版）(?!.*（教师版）)/, '（AI参考答案）');
    if (base.includes('(教师版)')) return base.replace(/\(教师版\)(?!.*\(教师版\))/, '(AI参考答案)');
    return `${base}（AI参考答案）`;
};

export const makeSafeFileName = (title) => {
    return makeAIReferenceTitle(title)
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_');
};
