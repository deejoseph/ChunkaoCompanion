import React, { useEffect } from 'react';

const modules = [
    { id: 'general', name: '🗣️ 通用口语', color: '#1890ff', description: '自由练习，支持场景对话' },
    { id: 'ielts', name: '🎙️ 雅思口语', color: '#52c41a', description: 'Part 1-3 全真模拟' },
    { id: 'toefl', name: '🌍 托福口语', color: '#fa8c16', description: 'Task 1-4 专项训练' }
];

function SpeakingNav({ activeModule, onSwitch, recognitionEngine, onRecognitionEngineChange }) {
    // 从 localStorage 初始化（只在首次渲染）
    useEffect(() => {
        const saved = localStorage.getItem('speaking_recognition_engine');
        if (saved && onRecognitionEngineChange) {
            onRecognitionEngineChange(saved);
        }
    }, []);

    const handleEngineChange = (engine) => {
        console.log('SpeakingNav - engine changed to:', engine);
        localStorage.setItem('speaking_recognition_engine', engine);
        if (onRecognitionEngineChange) {
            onRecognitionEngineChange(engine);
        }
    };

    return (
        <div>
            {/* 模块切换 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #e8e8e8', paddingBottom: '12px', flexWrap: 'wrap' }}>
                {modules.map(module => (
                    <button
                        key={module.id}
                        onClick={() => onSwitch(module.id)}
                        style={{
                            padding: '8px 20px',
                            background: activeModule === module.id ? module.color : '#f0f0f0',
                            color: activeModule === module.id ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            opacity: 1
                        }}
                        title={module.description}
                    >
                        {module.name}
                    </button>
                ))}
            </div>

            {/* 识别引擎选择 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
                padding: '8px 12px',
                background: '#f5f5f5',
                borderRadius: '8px',
                flexWrap: 'wrap'
            }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#666' }}>🎤 语音识别引擎：</span>
                <button
                    onClick={() => handleEngineChange('webspeech')}
                    style={{
                        padding: '6px 16px',
                        background: recognitionEngine === 'webspeech' ? '#1890ff' : 'white',
                        color: recognitionEngine === 'webspeech' ? 'white' : '#333',
                        border: '1px solid #d9d9d9',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}
                >
                    ⚡ 快速模式 (浏览器)
                </button>
                <button
                    onClick={() => handleEngineChange('whisper')}
                    style={{
                        padding: '6px 16px',
                        background: recognitionEngine === 'whisper' ? '#52c41a' : 'white',
                        color: recognitionEngine === 'whisper' ? 'white' : '#333',
                        border: '1px solid #d9d9d9',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}
                >
                    🎯 精准模式 (Whisper)
                </button>
                <span style={{ fontSize: '11px', color: '#999' }}>
                    {recognitionEngine === 'webspeech' ? '实时识别，无需等待' : '录音后识别，准确率更高'}
                </span>
            </div>
        </div>
    );
}

export default SpeakingNav;