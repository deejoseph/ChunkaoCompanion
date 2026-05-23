import React from 'react';
import { colors, cardStyle, badgeStyle, buttonStyle } from './styles';

function Part1Panel({ question, onNextQuestion }) {
    if (!question) return null;

    return (
        <div style={cardStyle}>
            <div style={{ marginBottom: '12px' }}>
                <span style={badgeStyle(colors.part1)}>Part 1 · {question.topic}</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', lineHeight: 1.5, marginBottom: '16px' }}>
                {question.question}
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                💡 提示：请用2-3句话回答，不要只说"Yes"或"No"
            </div>
            <button onClick={onNextQuestion} style={{ ...buttonStyle(colors.part1), padding: '6px 16px', fontSize: '13px' }}>
                🔄 换一题
            </button>
        </div>
    );
}

export default Part1Panel;