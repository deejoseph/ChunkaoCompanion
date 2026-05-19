import { useState, useRef, useEffect } from 'react';

function AudioDebugger({ isRecording }) {
    const [audioLevel, setAudioLevel] = useState(0);
    const [debugInfo, setDebugInfo] = useState('');
    const mediaStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceRef = useRef(null);
    const animationRef = useRef(null);
    const isContextClosedRef = useRef(false);

    useEffect(() => {
        if (isRecording) {
            startDebugging();
        } else {
            stopDebugging();
        }
        
        return () => {
            stopDebugging();
        };
    }, [isRecording]);

    const startDebugging = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;
            isContextClosedRef.current = false;
            
            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            source.connect(analyser);
            
            const updateLevel = () => {
                if (!isRecording || isContextClosedRef.current) return;
                try {
                    analyser.getByteTimeDomainData(dataArray);
                    
                    let maxSample = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        const v = (dataArray[i] - 128) / 128;
                        maxSample = Math.max(maxSample, Math.abs(v));
                    }
                    
                    const level = Math.min(100, Math.floor(maxSample * 100));
                    setAudioLevel(level);
                    
                    if (level > 10) {
                        setDebugInfo('🎤 检测到声音');
                    } else {
                        setDebugInfo('🔇 未检测到声音，请检查麦克风');
                    }
                } catch (e) {
                    console.log('音频分析错误:', e);
                }
                
                animationRef.current = requestAnimationFrame(updateLevel);
            };
            
            await audioContext.resume();
            updateLevel();
            
        } catch (error) {
            console.error('音频调试失败:', error);
            setDebugInfo(`❌ 麦克风错误: ${error.message}`);
        }
    };

    const stopDebugging = () => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        if (sourceRef.current) {
            try {
                sourceRef.current.disconnect();
            } catch (e) {}
            sourceRef.current = null;
        }
        if (audioContextRef.current && !isContextClosedRef.current) {
            try {
                audioContextRef.current.close();
                isContextClosedRef.current = true;
            } catch (e) {}
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        setAudioLevel(0);
        setDebugInfo('');
    };

    return (
        <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#f5f5f5',
            borderRadius: '8px',
            border: '1px solid #e8e8e8'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>🎵 麦克风检测</span>
                <div style={{
                    flex: 1,
                    height: '8px',
                    background: '#e8e8e8',
                    borderRadius: '4px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${audioLevel}%`,
                        height: '100%',
                        background: audioLevel > 30 ? '#52c41a' : audioLevel > 10 ? '#fa8c16' : '#ff4d4f',
                        transition: 'width 0.1s'
                    }} />
                </div>
                <span style={{ fontSize: '12px', color: '#666' }}>
                    音量: {audioLevel}%
                </span>
            </div>
            {debugInfo && (
                <div style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: debugInfo.includes('错误') ? '#ff4d4f' : '#52c41a'
                }}>
                    {debugInfo}
                </div>
            )}
        </div>
    );
}

export default AudioDebugger;