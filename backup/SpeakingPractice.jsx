import { useState } from 'react';

function SpeakingPractice() {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            height: 'calc(100vh - 60px)',
            textAlign: 'center',
            padding: '40px'
        }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎤</div>
            <h2>口语练习模块</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
                托福、雅思口语专项训练，即将上线
            </p>
            <div style={{
                background: '#f5f5f5',
                padding: '20px',
                borderRadius: '8px',
                maxWidth: '500px'
            }}>
                <strong>计划功能：</strong>
                <ul style={{ textAlign: 'left', marginTop: '10px' }}>
                    <li>🎙️ 口语题库（托福独立题、雅思Part1/2/3）</li>
                    <li>📊 AI 评分（发音、流利度、语法）</li>
                    <li>💡 参考答案与高分示例</li>
                    <li>📈 进步追踪</li>
                </ul>
            </div>
            <p style={{ color: '#999', marginTop: '30px', fontSize: '12px' }}>
                正在开发中，敬请期待...
            </p>
        </div>
    );
}

export default SpeakingPractice;