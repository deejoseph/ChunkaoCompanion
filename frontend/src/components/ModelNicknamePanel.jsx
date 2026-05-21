import { useState, useEffect } from 'react';
import { 
    getAllNicknames, 
    saveModelNickname, 
    resetModelNickname,
    getDefaultNicknames 
} from '../utils/nicknameHelper';

function ModelNicknamePanel() {
    const [nicknames, setNicknames] = useState({});
    const [defaultNicknames] = useState(getDefaultNicknames());
    const [editingModel, setEditingModel] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [activeSubject, setActiveSubject] = useState('math');

    // 加载昵称
    const loadNicknames = () => {
        setNicknames(getAllNicknames());
    };

    useEffect(() => {
        loadNicknames();
        const handleChange = () => loadNicknames();
        window.addEventListener('modelNicknamesChanged', handleChange);
        return () => window.removeEventListener('modelNicknamesChanged', handleChange);
    }, []);

    const subjects = [
        { id: 'math', name: '🧮 数学', color: '#1890ff' },
        { id: 'chinese', name: '📖 语文', color: '#52c41a' },
        { id: 'english', name: '🇬🇧 英语', color: '#fa8c16' }
    ];

    const getCurrentNickname = (subject, modelName) => {
        return nicknames[subject]?.[modelName]?.nickname || defaultNicknames[subject]?.[modelName]?.nickname || modelName;
    };

    const isCustomized = (subject, modelName) => {
        return !!nicknames[subject]?.[modelName];
    };

    const handleSave = (subject, modelName) => {
        if (editValue.trim()) {
            saveModelNickname(subject, modelName, editValue);
        }
        setEditingModel(null);
        setEditValue('');
    };

    const handleReset = (subject, modelName) => {
        resetModelNickname(subject, modelName);
    };

    return (
        <div>
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px',
                borderBottom: '1px solid #e8e8e8',
                paddingBottom: '12px'
            }}>
                {subjects.map(subject => (
                    <button
                        key={subject.id}
                        onClick={() => setActiveSubject(subject.id)}
                        style={{
                            padding: '6px 16px',
                            background: activeSubject === subject.id ? subject.color : '#f0f0f0',
                            color: activeSubject === subject.id ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        {subject.name}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(defaultNicknames[activeSubject] || {}).map(([modelName, modelData]) => {
                    const isEditing = editingModel === `${activeSubject}_${modelName}`;
                    const currentNickname = getCurrentNickname(activeSubject, modelName);
                    const customized = isCustomized(activeSubject, modelName);

                    return (
                        <div
                            key={modelName}
                            style={{
                                padding: '14px',
                                background: customized ? '#f6ffed' : '#fafafa',
                                borderRadius: '10px',
                                border: `1px solid ${customized ? '#b7eb8f' : '#e8e8e8'}`
                            }}
                        >
                            {isEditing ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSave(activeSubject, modelName)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid #1890ff',
                                            fontSize: '14px',
                                            width: '150px'
                                        }}
                                        autoFocus
                                        placeholder="输入昵称"
                                    />
                                    <button
                                        onClick={() => handleSave(activeSubject, modelName)}
                                        style={{
                                            padding: '4px 12px',
                                            background: '#52c41a',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✓ 保存
                                    </button>
                                    <button
                                        onClick={() => setEditingModel(null)}
                                        style={{
                                            padding: '4px 12px',
                                            background: '#999',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✗ 取消
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            background: customized ? '#e6f7ff' : '#f0f0f0',
                                            padding: '5px 14px',
                                            borderRadius: '20px',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            color: customized ? '#1890ff' : '#666'
                                        }}>
                                            🧑‍🎓 {currentNickname}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#999' }}>
                                            {modelName} ({modelData.defaultLabel})
                                        </span>
                                        {customized && (
                                            <span style={{
                                                fontSize: '11px',
                                                color: '#52c41a',
                                                background: '#f6ffed',
                                                padding: '2px 8px',
                                                borderRadius: '12px'
                                            }}>
                                                已自定义
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => {
                                                setEditingModel(`${activeSubject}_${modelName}`);
                                                setEditValue(currentNickname);
                                            }}
                                            style={{
                                                padding: '4px 12px',
                                                background: 'transparent',
                                                color: '#1890ff',
                                                border: '1px solid #1890ff',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '11px'
                                            }}
                                        >
                                            编辑
                                        </button>
                                        {customized && (
                                            <button
                                                onClick={() => handleReset(activeSubject, modelName)}
                                                style={{
                                                    padding: '4px 12px',
                                                    background: 'transparent',
                                                    color: '#ff4d4f',
                                                    border: '1px solid #ff4d4f',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '11px'
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

            <div style={{
                marginTop: '20px',
                padding: '12px',
                background: '#fff7e6',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#666'
            }}>
                💡 昵称将显示在 AI 助教回答中，格式：🧑‍🎓 昵称 (模型名) ⚠️ AI 生成，仅供参考
            </div>
        </div>
    );
}

export default ModelNicknamePanel;