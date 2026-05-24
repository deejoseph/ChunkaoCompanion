import { useState, useRef, useEffect } from 'react';

function VoiceRecorder({ 
    onTranscript, 
    onRecordingStart, 
    onRecordingStop, 
    onSentence, 
    onAudioBlob,
    disabled = false 
}) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recognitionRef = useRef(null);
    const timerRef = useRef(null);
    const spacePressedRef = useRef(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const streamRef = useRef(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const audioContextRef = useRef(null);
    const sourceRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);
    const isRecordingRef = useRef(false);

    // 直接从 localStorage 获取当前引擎（不依赖 props）
    const getIsWhisperMode = () => {
        const engine = localStorage.getItem('speaking_recognition_engine') || 'webspeech';
        return engine === 'whisper';
    };

    const startAudioAnalysis = async (stream) => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;
            
            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            const updateLevel = () => {
                if (!isRecordingRef.current) return;
                analyser.getByteTimeDomainData(dataArray);
                
                let maxSample = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const v = (dataArray[i] - 128) / 128;
                    maxSample = Math.max(maxSample, Math.abs(v));
                }
                
                const level = Math.min(100, Math.floor(maxSample * 100));
                setAudioLevel(level);
                
                animationRef.current = requestAnimationFrame(updateLevel);
            };
            
            await audioContext.resume();
            updateLevel();
            
        } catch (error) {
            console.error('音频分析启动失败:', error);
        }
    };

    const stopAudioAnalysis = () => {
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
        if (audioContextRef.current) {
            try {
                audioContextRef.current.close();
            } catch (e) {}
            audioContextRef.current = null;
        }
        setAudioLevel(0);
    };

    const startWebSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Web Speech API 不可用');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;
        
        recognition.onstart = () => console.log('Web Speech 录音开始');
        recognition.onresult = (event) => {
            let interimText = '', finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                if (result.isFinal) finalText += transcript;
                else interimText += transcript;
            }
            const text = finalText || interimText;
            if (onTranscript) onTranscript(text, !!finalText);
            if (finalText && onSentence) onSentence(finalText, true);
        };
        recognition.onerror = (e) => console.error('Web Speech 错误:', e.error);
        recognition.onend = () => console.log('Web Speech 录音结束');
        recognitionRef.current = recognition;
        recognition.start();
    };

    const startRecording = () => {
        if (disabled || isRecording) return;

        const isWhisperMode = getIsWhisperMode();
        console.log('startRecording - isWhisperMode (from localStorage):', isWhisperMode);

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                streamRef.current = stream;
                startAudioAnalysis(stream);
                audioChunksRef.current = [];

                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunksRef.current.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    console.log('MediaRecorder onstop 触发');
                    if (audioChunksRef.current.length > 0 && onAudioBlob) {
                        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                        const audioUrl = URL.createObjectURL(blob);
                        audioChunksRef.current = [];
                        onAudioBlob(blob, audioUrl, { transcribe: isWhisperMode });
                    }
                };

                mediaRecorder.start(100);

                isRecordingRef.current = true;
                setIsRecording(true);
                setRecordingTime(0);
                if (onRecordingStart) onRecordingStart();

                timerRef.current = setInterval(() => {
                    setRecordingTime(prev => prev + 1);
                }, 1000);

                if (!isWhisperMode) {
                    startWebSpeechRecognition();
                }
            })
            .catch(err => console.error('无法获取麦克风:', err));
    };

    const stopRecording = () => {
        console.log('stopRecording 被调用');
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        
        const isWhisperMode = getIsWhisperMode();
        if (!isWhisperMode && recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('请求剩余数据并停止 MediaRecorder');
            try { mediaRecorderRef.current.requestData(); } catch(e) {}
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
        
        if (streamRef.current) {
            console.log('关闭麦克风音轨');
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        stopAudioAnalysis();
        isRecordingRef.current = false;
        setIsRecording(false);
        setRecordingTime(0);
        if (onRecordingStop) onRecordingStop();
    };

    // 键盘事件
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !disabled && !isRecording && !spacePressedRef.current) {
                e.preventDefault();
                spacePressedRef.current = true;
                startRecording();
            }
        };
        const handleKeyUp = (e) => {
            if (e.code === 'Space' && isRecording) {
                e.preventDefault();
                spacePressedRef.current = false;
                stopRecording();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [disabled, isRecording]);

    // 清理
    useEffect(() => {
        return () => {
            stopAudioAnalysis();
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
            isRecordingRef.current = false;
        };
    }, []);

    const formatTime = (seconds) => {
        const secs = seconds % 60;
        return `${secs}秒`;
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <div
                style={{
                    width: '120px',
                    height: '120px',
                    margin: '0 auto',
                    borderRadius: '50%',
                    background: isRecording ? '#ff4d4f' : '#1890ff',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '48px',
                    transition: 'all 0.2s',
                    boxShadow: isRecording ? '0 0 20px rgba(255,77,79,0.6)' : '0 4px 12px rgba(0,0,0,0.15)',
                    opacity: disabled ? 0.5 : 1
                }}
            >
                {isRecording ? '🎤' : '🎙️'}
            </div>
            {isRecording && (
                <div style={{ marginTop: '12px', width: '200px', margin: '12px auto 0' }}>
                    <div style={{ height: '4px', background: '#e8e8e8', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${audioLevel}%`, height: '100%', background: audioLevel > 30 ? '#52c41a' : audioLevel > 10 ? '#fa8c16' : '#ff4d4f', transition: 'width 0.1s' }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>音量: {audioLevel}%</div>
                </div>
            )}
            {isRecording && (
                <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'inline-block', padding: '4px 12px', background: '#ff4d4f', color: 'white', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                        🔴 Recording... {formatTime(recordingTime)}
                    </div>
                </div>
            )}
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                {isRecording ? 'Release Space to stop' : 'Hold Space to record'}
            </div>
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#999' }}>
                💡 Speak clearly
            </div>
        </div>
    );
}

export default VoiceRecorder;