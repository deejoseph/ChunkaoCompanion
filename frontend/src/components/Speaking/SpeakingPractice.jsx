import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceRecorder from './VoiceRecorder';
import AudioDebugger from './AudioDebugger';

const API_BASE = 'http://localhost:3001';

function SpeakingPractice() {
    const [transcript, setTranscript] = useState('');
    const [interimText, setInterimText] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const finalTranscriptRef = useRef('');
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // 雅思 Part1 高频话题
    const topics = [
        { id: 1, question: "Do you like reading books? Why or why not?", category: "Hobby" },
        { id: 2, question: "What kind of music do you enjoy listening to?", category: "Music" },
        { id: 3, question: "Do you prefer to work or study alone or with others?", category: "Study" },
        { id: 4, question: "How often do you use the internet?", category: "Technology" },
        { id: 5, question: "What's your favorite season and why?", category: "Weather" },
        { id: 6, question: "Do you like to travel? Why or why not?", category: "Travel" },
        { id: 7, question: "What sports do you enjoy playing or watching?", category: "Sports" },
        { id: 8, question: "How do you usually celebrate festivals?", category: "Culture" },
    ];

    // 处理语音识别结果
    const handleTranscript = (text, isFinal) => {
        console.log('=== handleTranscript 被调用 ===');
        console.log('识别文本:', text);
        console.log('是否最终:', isFinal);
        
        if (isFinal) {
            finalTranscriptRef.current = text;
            setTranscript(text);
            setInterimText('');
        } else {
            setInterimText(text);
        }
    };

    // 开始录音时同时录制音频
    const handleRecordingStart = () => {
        console.log('开始录音');
        setIsRecording(true);
        audioChunksRef.current = [];
        setAudioUrl(null);
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorderRef.current = new MediaRecorder(stream);
                mediaRecorderRef.current.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };
                mediaRecorderRef.current.onstop = () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const url = URL.createObjectURL(blob);
                    setAudioUrl(url);
                    stream.getTracks().forEach(track => track.stop());
                };
                mediaRecorderRef.current.start();
            })
            .catch(err => console.error('无法获取麦克风:', err));
    };

    const handleRecordingStop = () => {
        console.log('停止录音');
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const clearAnswer = () => {
        finalTranscriptRef.current = '';
        setTranscript('');
        setInterimText('');
        setAiResponse('');
        setAudioUrl(null);
        audioChunksRef.current = [];
    };

    const analyzeWithAI = async () => {
        const currentTranscript = finalTranscriptRef.current || transcript;
        if (!currentTranscript.trim()) {
            alert('请先录音说出你的回答');
            return;
        }

        if (!selectedTopic) {
            alert('请先选择一个话题');
            return;
        }

        setLoading(true);
        setAiResponse('');

        const analysisPrompt = `你是雅思考官。评分学生回答：

话题：${selectedTopic.question}
回答：${currentTranscript}

输出格式（Markdown）：

**评分：** 流利度 X/9 | 语法 X/9 | 词汇 X/9 | 发音 X/9

**优点：** 简洁列出
**改进：** 简洁列出
**高分范例：** ${selectedTopic.question} -> 简短范例回答

**语法修正：** 如有错误，给出修正`;

        try {
            const model = localStorage.getItem('english_model_fast') || 'qwen2.5:7b';
            
            const response = await axios.post(`${API_BASE}/api/ai/ask`, {
                subject: 'english',
                question: analysisPrompt,
                model: model
            });

            if (response.data.success) {
                setAiResponse(response.data.answer);
            } else {
                setAiResponse(`错误: ${response.data.error}`);
            }
        } catch (error) {
            console.error('AI 分析失败:', error);
            setAiResponse(`请求失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
            <h1>🎤 口语练习 - 雅思 Part1 高频话题</h1>
            
            {/* 话题选择 */}
            <div style={{ marginBottom: '24px' }}>
                <h3>📋 选择话题</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {topics.map(topic => (
                        <button
                            key={topic.id}
                            onClick={() => {
                                setSelectedTopic(topic);
                                clearAnswer();
                            }}
                            style={{
                                padding: '8px 16px',
                                background: selectedTopic?.id === topic.id ? '#1890ff' : '#f0f0f0',
                                color: selectedTopic?.id === topic.id ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontSize: '13px'
                            }}
                        >
                            {topic.category}
                        </button>
                    ))}
                </div>
            </div>

            {/* 当前话题 */}
            {selectedTopic && (
                <div style={{
                    background: '#e6f7ff',
                    padding: '16px 20px',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    border: '1px solid #91d5ff'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🎯 当前话题</div>
                    <div style={{ fontSize: '16px', lineHeight: '1.5', fontWeight: 'bold' }}>
                        {selectedTopic.question}
                    </div>
                </div>
            )}

            {/* 录音区域 */}
            <div style={{
                background: '#fafafa',
                padding: '30px 20px',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '24px',
                border: isRecording ? '2px solid #ff4d4f' : '1px solid #e8e8e8',
                transition: 'all 0.2s'
            }}>
                <VoiceRecorder
                    onTranscript={handleTranscript}
                    onRecordingStart={handleRecordingStart}
                    onRecordingStop={handleRecordingStop}
                    disabled={!selectedTopic}
                />
                
                {/* 音频调试器 */}
                <AudioDebugger isRecording={isRecording} />
                
                {/* 录音回放 */}
                {audioUrl && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>🎵 录音回放</div>
                        <audio controls src={audioUrl} style={{ width: '100%', maxWidth: '300px' }} />
                    </div>
                )}
                
                {!selectedTopic && (
                    <div style={{ marginTop: '16px', color: '#999', fontSize: '13px' }}>
                        请先点击上方选择话题
                    </div>
                )}
            </div>

            {/* 识别结果 - 确保这个区域始终可见 */}
            <div style={{
                background: '#f6ffed',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #b7eb8f',
                minHeight: '100px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold' }}>
                        📝 识别结果
                        {interimText && !transcript && <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>（识别中...）</span>}
                    </div>
                    {transcript && (
                        <button
                            onClick={clearAnswer}
                            style={{
                                padding: '2px 8px',
                                background: 'transparent',
                                color: '#999',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            清空
                        </button>
                    )}
                </div>
                <div style={{ fontSize: '16px', lineHeight: '1.5', whiteSpace: 'pre-wrap', minHeight: '60px' }}>
                    {transcript || interimText || '等待录音...'}
                </div>
            </div>

            {/* AI 分析按钮 */}
            {transcript && !loading && (
                <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                    <button
                        onClick={analyzeWithAI}
                        style={{
                            padding: '10px 24px',
                            background: '#52c41a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '30px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        🤖 AI 分析回答
                    </button>
                </div>
            )}

            {loading && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#1890ff' }}>
                    🤖 AI 分析中，请稍候...
                </div>
            )}

            {/* AI 反馈 */}
            {aiResponse && (
                <div style={{
                    background: '#f5f5f5',
                    padding: '20px',
                    borderRadius: '8px',
                    marginTop: '20px'
                }}>
                    <h3>🤖 AI 反馈</h3>
                    <div className="markdown-body" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {aiResponse}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {/* 使用说明 */}
            <div style={{
                marginTop: '30px',
                padding: '16px',
                background: '#fff7e6',
                borderRadius: '8px',
                border: '1px solid #ffc53d'
            }}>
                <strong>💡 使用说明：</strong>
                <ul style={{ margin: '8px 0 0 20px', lineHeight: '1.6' }}>
                    <li>1. 点击上方选择话题</li>
                    <li>2. <strong>按住空格键不放</strong>开始录音，松开自动结束</li>
                    <li>3. 识别结果会显示在下方区域</li>
                    <li>4. 点击「AI 分析回答」获取评分和反馈</li>
                </ul>
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                    💡 建议使用 Chrome 浏览器，说话时请靠近麦克风
                </p>
            </div>
        </div>
    );
}

export default SpeakingPractice;