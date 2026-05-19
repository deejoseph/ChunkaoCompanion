import { useState, useRef, useEffect } from 'react';

function VoiceRecorder({ onTranscript, onRecordingStart, onRecordingStop, disabled = false }) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recognitionRef = useRef(null);
    const timerRef = useRef(null);
    const spacePressedRef = useRef(false);
    const finalTextRef = useRef('');

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
        
        finalTextRef.current = '';

        recognition.onstart = () => {
            console.log('Recording started');
            setIsRecording(true);
            setRecordingTime(0);
            if (onRecordingStart) onRecordingStart();
            
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        };

        recognition.onresult = (event) => {
            let interimText = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                if (result.isFinal) {
                    finalTextRef.current += ' ' + transcript;
                } else {
                    interimText += transcript;
                }
            }
            
            const displayText = (finalTextRef.current + interimText).trim();
            if (onTranscript) {
                onTranscript(displayText, false);
            }
        };

        recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            if (event.error === 'no-speech') {
                console.log('No speech detected');
            }
        };

        recognition.onend = () => {
            console.log('Recording ended, final text:', finalTextRef.current);
            const finalText = finalTextRef.current.trim();
            if (onTranscript) {
                onTranscript(finalText || 'No speech detected', true);
            }
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (onRecordingStop) onRecordingStop();
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
                <div style={{ marginTop: '16px' }}>
                    <div style={{
                        display: 'inline-block',
                        padding: '6px 16px',
                        background: '#ff4d4f',
                        color: 'white',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}>
                        🔴 Recording... {formatTime(recordingTime)}
                    </div>
                </div>
            )}
            
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                {isRecording ? 'Release Space to stop' : 'Hold Space to record'}
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#999' }}>
                💡 Speak clearly in English
            </div>
        </div>
    );
}

export default VoiceRecorder;