import React from 'react';

const modules = [
    { id: 'general', name: '🗣️ 通用口语', color: '#1890ff', description: '自由练习，支持场景对话' },
    { id: 'ielts', name: '🎙️ 雅思口语', color: '#52c41a', description: 'Part 1-3 全真模拟' },
    { id: 'toefl', name: '🌍 托福口语', color: '#fa8c16', description: 'Task 1-4 专项训练', disabled: true }
];

function SpeakingNav({ activeModule, onSwitch }) {
    return (
        <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px',
            borderBottom: '1px solid #e8e8e8',
            paddingBottom: '12px',
            flexWrap: 'wrap'
        }}>
            {modules.map(module => (
                <button
                    key={module.id}
                    onClick={() => !module.disabled && onSwitch(module.id)}
                    style={{
                        padding: '8px 20px',
                        background: activeModule === module.id ? module.color : '#f0f0f0',
                        color: activeModule === module.id ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: module.disabled ? 'not-allowed' : 'pointer',
                        opacity: module.disabled ? 0.5 : 1
                    }}
                    title={module.disabled ? '开发中...' : module.description}
                >
                    {module.name}
                </button>
            ))}
        </div>
    );
}

export default SpeakingNav;