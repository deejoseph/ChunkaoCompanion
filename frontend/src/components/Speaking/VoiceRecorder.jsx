import { useState, useRef, useEffect } from 'react';

function VoiceRecorder({ onTranscript, onRecordingStart, onRecordingStop, onSentence, disabled = false }) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recognitionRef = useRef(null);
    const timerRef = useRef(null);
    const spacePressedRef = useRef(false);
    const currentSentenceRef = useRef('');
    const [audioLevel, setAudioLevel] = useState(0);
    const mediaStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);

    // 音频分析（仅用于显示音量）
    const startAudioAnalysis = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
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
                if (!isRecording) return;
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
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        setAudioLevel(0);
    };

    const startRecording = () => {
        if (disabled || isRecording) return;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Your browser does not support speech recognition. Please use Chrome.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;
        
        currentSentenceRef.current = '';

        recognition.onstart = () => {
            console.log('Recording started');
            setIsRecording(true);
            setRecordingTime(0);
            if (onRecordingStart) onRecordingStart();
            startAudioAnalysis();
            
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        };

        recognition.onresult = (event) => {
            let interimText = '';
            let finalText = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                if (result.isFinal) {
                    // 这是一个完整的句子
                    finalText = transcript;
                    currentSentenceRef.current = transcript;
                    // 立即提交句子
                    if (onSentence) {
                        onSentence(transcript, true);
                    }
                    if (onTranscript) {
                        onTranscript(transcript, true);
                    }
                } else {
                    interimText += transcript;
                }
            }
            
            // 显示中间结果（正在识别的部分）
            if (interimText) {
                if (onTranscript) {
                    onTranscript(interimText, false);
                }
            }
        };

        recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            if (event.error === 'no-speech') {
                console.log('No speech detected');
            } else if (event.error === 'audio-capture') {
                alert('Cannot access microphone. Please check permissions.');
            }
        };

        recognition.onend = () => {
            console.log('Recognition ended');
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (onRecordingStop) onRecordingStop();
            stopAudioAnalysis();
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    };

    // 空格键控制
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
            
            {/* 音量波形 */}
            {isRecording && (
                <div style={{ marginTop: '12px', width: '200px', margin: '12px auto 0' }}>
                    <div style={{
                        height: '4px',
                        background: '#e8e8e8',
                        borderRadius: '2px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${audioLevel}%`,
                            height: '100%',
                            background: audioLevel > 30 ? '#52c41a' : audioLevel > 10 ? '#fa8c16' : '#ff4d4f',
                            transition: 'width 0.1s'
                        }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                        音量: {audioLevel}%
                    </div>
                </div>
            )}
            
            {isRecording && (
                <div style={{ marginTop: '12px' }}>
                    <div style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: '#ff4d4f',
                        color: 'white',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>
                        🔴 Recording... {formatTime(recordingTime)}
                    </div>
                </div>
            )}
            
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                {isRecording ? 'Release Space to stop' : 'Hold Space to record'}
            </div>
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#999' }}>
                💡 Speak clearly. The system will split sentences automatically.
            </div>
        </div>
    );
}

export default VoiceRecorder;