import { useState, useEffect } from 'react';

const STORAGE_KEY = 'model_nicknames';

// 默认昵称配置
const DEFAULT_NICKNAMES = {
    math: {
        'qwen2-math:1.5b': { nickname: '速算小能手', modelLabel: '⚡ 轻量模式' },
        'qwen2.5:7b': { nickname: '数学小助手', modelLabel: '🚀 快速模式' },
        'qwen2-math:7b': { nickname: '数学博士', modelLabel: '🎯 标准模式' },
        'qwen2.5:14b': { nickname: '数学教授', modelLabel: '🏆 专业模式' },
        'qwen2.5-coder:7b': { nickname: '公式大师', modelLabel: '🎨 美观模式' }
    },
    chinese: {
        'qwen2.5:7b': { nickname: '文曲星', modelLabel: '🚀 快速模式' },
        'qwen2.5:14b': { nickname: '语文老师', modelLabel: '🏆 专业模式' },
        'glm4:9b': { nickname: '古文专家', modelLabel: '📖 古文模式' },
        'gemma3:4b': { nickname: '文学青年', modelLabel: '📝 标准模式' },
        'qwen2.5-coder:7b': { nickname: '规范助手', modelLabel: '📐 规范模式' }
    },
    english: {
        'qwen2.5:7b': { nickname: '英语课代表', modelLabel: '🚀 快速模式' },
        'qwen2.5:14b': { nickname: '外教老师', modelLabel: '🏆 专业模式' },
        'gemma3:4b': { nickname: '口语伙伴', modelLabel: '🎙️ 口语模式' },
        'qwen2.5-coder:7b': { nickname: '翻译官', modelLabel: '🌍 翻译模式' }
    }
};

// 导出工具函数，供其他组件使用
export const getModelNickname = (subject, modelName) => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed[subject] && parsed[subject][modelName] && parsed[subject][modelName].nickname) {
                return parsed[subject][modelName].nickname;
            }
        } catch (e) {}
    }
    return DEFAULT_NICKNAMES[subject]?.[modelName]?.nickname || modelName;
};

function ModelNicknameSettings() {
    const [nicknames, setNicknames] = useState(DEFAULT_NICKNAMES);
    const [editingModel, setEditingModel] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [activeSubject, setActiveSubject] = useState('math');

    // 加载保存的昵称
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const merged = JSON.parse(JSON.stringify(DEFAULT_NICKNAMES));
                for (const subject in parsed) {
                    if (merged[subject]) {
                        for (const model in parsed[subject]) {
                            if (merged[subject][model]) {
                                merged[subject][model].nickname = parsed[subject][model].nickname;
                            }
                        }
                    }
                }
                setNicknames(merged);
            } catch (e) {
                console.error('加载昵称失败:', e);
            }
        }
    }, []);

    // 保存昵称
    const saveNickname = (subject, modelName, newNickname) => {
        if (!newNickname.trim()) return;
        
        const updated = JSON.parse(JSON.stringify(nicknames));
        if (updated[subject] && updated[subject][modelName]) {
            updated[subject][modelName].nickname = newNickname.trim();
            setNicknames(updated);
            
            // 保存到 localStorage
            const toSave = {};
            for (const s in updated) {
                toSave[s] = {};
                for (const m in updated[s]) {
                    toSave[s][m] = { nickname: updated[s][m].nickname };
                }
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
            
            // 触发事件，通知其他组件更新
            window.dispatchEvent(new CustomEvent('modelNicknamesChanged', { detail: toSave }));
        }
        setEditingModel(null);
        setEditValue('');
    };

    // 重置所有
    const resetAll = () => {
        if (confirm('确定要重置所有昵称为默认值吗？')) {
            setNicknames(DEFAULT_NICKNAMES);
            localStorage.removeItem(STORAGE_KEY);
            window.dispatchEvent(new CustomEvent('modelNicknamesChanged', { detail: DEFAULT_NICKNAMES }));
        }
    };

    // 重置单个模型
    const resetSingle = (subject, modelName) => {
        const updated = JSON.parse(JSON.stringify(nicknames));
        if (updated[subject] && updated[subject][modelName]) {
            updated[subject][modelName].nickname = DEFAULT_NICKNAMES[subject][modelName].nickname;
            setNicknames(updated);
            
            const toSave = {};
            for (const s in updated) {
                toSave[s] = {};
                for (const m in updated[s]) {
                    toSave[s][m] = { nickname: updated[s][m].nickname };
                }
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
            window.dispatchEvent(new CustomEvent('modelNicknamesChanged', { detail: toSave }));
        }
    };

    const subjects = [
        { id: 'math', name: '🧮 数学', color: '#1890ff' },
        { id: 'chinese', name: '📖 语文', color: '#52c41a' },
        { id: 'english', name: '🇬🇧 英语', color: '#fa8c16' }
    ];

    return (
        <div style={{ padding: '20px' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div>
                    <h2 style={{ margin: 0 }}>🎭 AI 模型昵称</h2>
                    <p style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                        给 AI 模型起个昵称，在 AI 参考答案中显示，增加学习趣味性
                    </p>
                </div>
                <button
                    onClick={resetAll}
                    style={{
                        padding: '8px 16px',
                        background: '#ff4d4f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}
                >
                    🔄 重置所有昵称
                </button>
            </div>

            {/* 学科切换 */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                borderBottom: '1px solid #e8e8e8',
                paddingBottom: '12px'
            }}>
                {subjects.map(subject => (
                    <button
                        key={subject.id}
                        onClick={() => setActiveSubject(subject.id)}
                        style={{
                            padding: '8px 20px',
                            background: activeSubject === subject.id ? subject.color : '#f0f0f0',
                            color: activeSubject === subject.id ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        {subject.name}
                    </button>
                ))}
            </div>

            {/* 模型列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(nicknames[activeSubject] || {}).map(([modelName, modelData]) => {
                    const isEditing = editingModel === `${activeSubject}_${modelName}`;
                    
                    return (
                        <div
                            key={modelName}
                            style={{
                                padding: '16px',
                                background: '#fafafa',
                                borderRadius: '12px',
                                border: '1px solid #e8e8e8'
                            }}
                        >
                            {isEditing ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && saveNickname(activeSubject, modelName, editValue)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid #1890ff',
                                            fontSize: '14px',
                                            width: '160px'
                                        }}
                                        autoFocus
                                        placeholder="输入昵称"
                                    />
                                    <button
                                        onClick={() => saveNickname(activeSubject, modelName, editValue)}
                                        style={{
                                            padding: '6px 14px',
                                            background: '#52c41a',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✓ 保存
                                    </button>
                                    <button
                                        onClick={() => setEditingModel(null)}
                                        style={{
                                            padding: '6px 14px',
                                            background: '#999',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✗ 取消
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            background: '#e6f7ff',
                                            padding: '6px 14px',
                                            borderRadius: '20px',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            color: '#1890ff'
                                        }}>
                                            🧑‍🎓 {modelData.nickname}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#999' }}>
                                            {modelName} ({modelData.modelLabel})
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => {
                                                setEditingModel(`${activeSubject}_${modelName}`);
                                                setEditValue(modelData.nickname);
                                            }}
                                            style={{
                                                padding: '4px 12px',
                                                background: 'transparent',
                                                color: '#1890ff',
                                                border: '1px solid #1890ff',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                        >
                                            编辑
                                        </button>
                                        {modelData.nickname !== DEFAULT_NICKNAMES[activeSubject][modelName].nickname && (
                                            <button
                                                onClick={() => resetSingle(activeSubject, modelName)}
                                                style={{
                                                    padding: '4px 12px',
                                                    background: 'transparent',
                                                    color: '#ff4d4f',
                                                    border: '1px solid #ff4d4f',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                重置
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 使用说明 */}
            <div style={{
                marginTop: '30px',
                padding: '16px',
                background: '#fff7e6',
                borderRadius: '8px',
                border: '1px solid #ffc53d'
            }}>
                <strong>💡 说明：</strong>
                <ul style={{ margin: '8px 0 0 20px', lineHeight: '1.6' }}>
                    <li>昵称将在 <strong>AI 参考答案</strong> 中显示，格式为：<code>🧑‍🎓 昵称 (模型名)</code></li>
                    <li>点击「编辑」可以自定义昵称，点击「重置」恢复默认</li>
                    <li>昵称会自动保存到浏览器，更换设备后需要重新设置</li>
                </ul>
            </div>
        </div>
    );
}

export default ModelNicknameSettings;