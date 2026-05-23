import React, { useState, useEffect, useRef } from 'react';
import { colors, cardStyle, badgeStyle, buttonStyle, timerStyle } from './styles';

function Part2Panel({ topic, onStartPreparation, onPreparationStart, onSpeakingStart, onStopSpeaking }) {
    const [preparationTime, setPreparationTime] = useState(0);
    const [speakingTime, setSpeakingTime] = useState(0);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const timerRef = useRef(null);
    const speakingTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (speakingTimerRef.current) clearInterval(speakingTimerRef.current);
        };
    }, []);

    const startPreparation = () => {
        setIsPreparing(true);
        setPreparationTime(60);
        if (onPreparationStart) onPreparationStart();
        
        timerRef.current = setInterval(() => {
            setPreparationTime(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setIsPreparing(false);
                    startSpeaking();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startSpeaking = () => {
        setIsSpeaking(true);
        setSpeakingTime(120);
        if (onSpeakingStart) onSpeakingStart();
        
        speakingTimerRef.current = setInterval(() => {
            setSpeakingTime(prev => {
                if (prev <= 1) {
                    clearInterval(speakingTimerRef.current);
                    setIsSpeaking(false);
                    if (onStopSpeaking) onStopSpeaking();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stopSpeaking = () => {
        if (speakingTimerRef.current) {
            clearInterval(speakingTimerRef.current);
            speakingTimerRef.current = null;
        }
        setIsSpeaking(false);
        if (onStopSpeaking) onStopSpeaking();
    };

    if (!topic) return null;

    return (
        <div style={cardStyle}>
            <div style={{ marginBottom: '12px' }}>
                <span style={badgeStyle(colors.part2)}>Part 2 · 个人陈述</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                {topic.title}
            </div>
            <div style={{ padding: '12px', background: '#f6ffed', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>你应该说：</div>
                {topic.prompts.map((prompt, idx) => (
                    <div key={idx} style={{ marginBottom: '4px' }}>• {prompt}</div>
                ))}
            </div>
            
            {isPreparing && (
                <div style={{ ...timerStyle, background: '#fff7e6', color: '#fa8c16', marginBottom: '12px' }}>
                    ⏰ 准备时间：{preparationTime} 秒
                </div>
            )}
            
            {isSpeaking && (
                <div style={{ ...timerStyle, background: '#ff4d4f', color: 'white', marginBottom: '12px' }}>
                    🎙️ 发言中... 剩余 {speakingTime} 秒
                    <button onClick={stopSpeaking} style={{ marginLeft: '12px', background: 'white', color: '#ff4d4f', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}>
                        提前结束
                    </button>
                </div>
            )}
            
            {!isPreparing && !isSpeaking && preparationTime === 0 && (
                <button onClick={startPreparation} style={buttonStyle(colors.part2)}>
                    开始准备 (60秒)
                </button>
            )}
        </div>
    );
}

export default Part2Panel;