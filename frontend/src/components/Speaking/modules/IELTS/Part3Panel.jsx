import React from 'react';
import { colors, cardStyle, badgeStyle, buttonStyle } from './styles';

function Part3Panel({ questions, currentIndex, onNext, onPrev }) {
    if (!questions || questions.length === 0) return null;
    
    const currentQuestion = questions[currentIndex];

    return (
        <div style={cardStyle}>
            <div style={{ marginBottom: '12px' }}>
                <span style={badgeStyle(colors.part3)}>Part 3 · 抽象话题讨论</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', lineHeight: 1.5, marginBottom: '16px' }}>
                {currentQuestion}
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                💡 提示：表达你的观点并给出理由，可以用例子支持
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
                {currentIndex > 0 && (
                    <button onClick={onPrev} style={{ ...buttonStyle('#f0f0f0'), color: '#333', background: '#f0f0f0' }}>
                        ◀ 上一题
                    </button>
                )}
                {currentIndex < questions.length - 1 && (
                    <button onClick={onNext} style={buttonStyle(colors.part3)}>
                        下一题 ▶
                    </button>
                )}
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '12px' }}>
                进度：{currentIndex + 1} / {questions.length}
            </div>
        </div>
    );
}

export default Part3Panel;