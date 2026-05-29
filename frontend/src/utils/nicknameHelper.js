// 昵称存储 key
const STORAGE_KEY = 'model_nicknames';

// 默认昵称配置（与学科模型对应）
const DEFAULT_NICKNAMES = {
    // 数学学科
    math: {
        'qwen2-math:1.5b': { nickname: '速算小能手', defaultLabel: '⚡ 轻量模式' },
        'qwen2.5:7b': { nickname: '数学小助手', defaultLabel: '🚀 快速模式' },
        'qwen2-math:7b': { nickname: '数学博士', defaultLabel: '🎯 标准模式' },
        'qwen2.5:14b': { nickname: '数学教授', defaultLabel: '🏆 专业模式' },
        'qwen2.5-coder-fast': { nickname: '公式大师', defaultLabel: '🎨 美观模式' }
    },
    // 语文学科
    chinese: {
        'qwen2.5:7b': { nickname: '文曲星', defaultLabel: '🚀 快速模式' },
        'qwen2.5:14b': { nickname: '语文老师', defaultLabel: '🏆 专业模式' },
        'glm4:9b': { nickname: '古文专家', defaultLabel: '📖 参考模式' },
        'gemma3:4b': { nickname: '文学青年', defaultLabel: '📝 标准模式' },
        'qwen2.5-coder-fast': { nickname: '规范助手', defaultLabel: '📐 规范模式' }
    },
    // 英语学科
    english: {
        'qwen2.5:7b': { nickname: '英语课代表', defaultLabel: '🚀 快速模式' },
        'qwen2.5:14b': { nickname: '外教老师', defaultLabel: '🏆 专业模式' },
        'gemma3:4b': { nickname: '口语伙伴', defaultLabel: '🎙️ 快速模式' },
        'qwen2.5-coder-fast': { nickname: '翻译官', defaultLabel: '🌍 参考模式' }
    }
};

// 获取模型昵称
export const getModelNickname = (subject, modelName) => {
    // 从 localStorage 读取
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed[subject] && parsed[subject][modelName] && parsed[subject][modelName].nickname) {
                return parsed[subject][modelName].nickname;
            }
        } catch (e) {}
    }
    // 返回默认昵称
    return DEFAULT_NICKNAMES[subject]?.[modelName]?.nickname || modelName;
};

// 获取所有昵称配置
export const getAllNicknames = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {}
    }
    return {};
};

// 保存单个模型的昵称
export const saveModelNickname = (subject, modelName, nickname) => {
    if (!nickname.trim()) return false;
    
    const current = getAllNicknames();
    if (!current[subject]) current[subject] = {};
    if (!current[subject][modelName]) current[subject][modelName] = {};
    
    current[subject][modelName].nickname = nickname.trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    
    // 触发事件，通知其他组件更新
    window.dispatchEvent(new CustomEvent('modelNicknamesChanged'));
    return true;
};

// 重置单个模型的昵称
export const resetModelNickname = (subject, modelName) => {
    const current = getAllNicknames();
    if (current[subject] && current[subject][modelName]) {
        delete current[subject][modelName];
        if (Object.keys(current[subject]).length === 0) {
            delete current[subject];
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        window.dispatchEvent(new CustomEvent('modelNicknamesChanged'));
        return true;
    }
    return false;
};

// 重置所有昵称
export const resetAllNicknames = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('modelNicknamesChanged'));
};

// 导出默认配置供组件使用
export const getDefaultNicknames = () => DEFAULT_NICKNAMES;