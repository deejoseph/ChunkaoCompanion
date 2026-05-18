// 学科配置
export const SUBJECTS = {
    chinese: { name: '语文' },
    math: { name: '数学' },
    english: { name: '英语' },
    custom: { name: '自定义' }
};

export const SUBJECT_NAMES = {
    chinese: '语文',
    math: '数学',
    english: '英语'
};

// 答案标记预设
export const ANSWER_MARKERS = ['【答案】', '【参考答案】', '答案：', '参考答案：'];
export const ANALYSIS_MARKERS = ['【解析】', '【详解】', '【常规讲解】', '解析：', '详解：'];
export const QUESTION_PATTERNS = ['练习', '\\d+[．、.]', '【题目】'];

// API 地址
export const API_BASE = 'http://localhost:3001';