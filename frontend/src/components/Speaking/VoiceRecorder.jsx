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

    // 判断是否为 Whisper 模式
    const isWhisperMode = !!onAudioBlob;

    // 音频分析
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
        setAudioLevel(0);
    };

    // Web Speech API 识别（仅快速模式）
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
        
        let currentSentence = '';

        recognition.onstart = () => {
            console.log('Web Speech 录音开始');
        };

        recognition.onresult = (event) => {
            let interimText = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                if (result.isFinal) {
                    currentSentence = transcript;
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
            
            if (interimText && onTranscript) {
                onTranscript(interimText, false);
            }
        };

        recognition.onerror = (event) => {
            console.error('Web Speech 错误:', event.error);
        };

        recognition.onend = () => {
            console.log('Web Speech 录音结束');
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const startRecording = () => {
        if (disabled || isRecording) return;
        
        // 启动 MediaRecorder（用于 Whisper 模式或录音回放）
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                streamRef.current = stream;
                startAudioAnalysis(stream);
                
                mediaRecorderRef.current = new MediaRecorder(stream);
                audioChunksRef.current = [];
                
                mediaRecorderRef.current.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };
                
                mediaRecorderRef.current.start();
                
                // 设置录音状态
                setIsRecording(true);
                setRecordingTime(0);
                if (onRecordingStart) onRecordingStart();
                
                timerRef.current = setInterval(() => {
                    setRecordingTime(prev => prev + 1);
                }, 1000);
                
                // 如果不是 Whisper 模式，启动 Web Speech API 实时识别
                if (!isWhisperMode) {
                    startWebSpeechRecognition();
                }
            })
            .catch(err => console.error('无法获取麦克风:', err));
    };

    const stopRecording = () => {
        console.log('stopRecording 被调用');

        // 停止 Web Speech API（仅快速模式）
        if (!isWhisperMode && recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        // 停止 MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('停止 MediaRecorder');
            mediaRecorderRef.current.onstop = () => {
                console.log('MediaRecorder onstop 触发');
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (onAudioBlob) {
                    onAudioBlob(blob);
                }
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
            };
            mediaRecorderRef.current.stop();
        } else {
            console.log('MediaRecorder 未在录音状态');
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setIsRecording(false);
        setRecordingTime(0);
        stopAudioAnalysis();

        if (onRecordingStop) {
            onRecordingStop();
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
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
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
                💡 Speak clearly
            </div>
        </div>
    );
}

export default VoiceRecorder;