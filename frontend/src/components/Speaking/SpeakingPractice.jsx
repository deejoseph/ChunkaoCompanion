import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceRecorder from './VoiceRecorder';
import AudioDebugger from './AudioDebugger';

const API_BASE = 'http://localhost:3001';

function SpeakingPractice() {
    const [aiResponse, setAiResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [sentences, setSentences] = useState([]);
    const [currentInterim, setCurrentInterim] = useState('');
    const [fullTranscript, setFullTranscript] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const isSpeakingRef = useRef(false);
    const speakTimeoutRef = useRef(null);
    const [conversationHistory, setConversationHistory] = useState([]);
    const [isConversationMode, setIsConversationMode] = useState(false);
    
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const finalTranscriptRef = useRef('');
    const utteranceRef = useRef(null);

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

    // 场景化对话预设
    const scenarios = [
        { id: 'interview', name: '💼 求职面试', icon: '💼', systemPrompt: '你是一位面试官，正在面试一位应聘者。请用英文提问，问题要专业但友好。' },
        { id: 'visa', name: '🛂 签证面试', icon: '🛂', systemPrompt: '你是一位签证官，正在面试申请签证的人。请用英文提问，问题要正式但礼貌。' },
        { id: 'business', name: '📊 商务会议', icon: '📊', systemPrompt: '你是一位商务合作伙伴，正在讨论合作事宜。请用英文交流，语气专业。' },
        { id: 'shopping', name: '🛍️ 购物', icon: '🛍️', systemPrompt: '你是一位商店店员，正在帮助顾客。请用英文对话，友好热情。' },
        { id: 'travel', name: '✈️ 旅游', icon: '✈️', systemPrompt: '你是一位当地导游，正在和游客聊天。请用英文对话，介绍当地风情。' },
        { id: 'cafe', name: '☕ 咖啡厅', icon: '☕', systemPrompt: '你是一位咖啡厅店员，正在接待顾客。请用英文对话，轻松自然。' }
    ];

    const [selectedScenario, setSelectedScenario] = useState(null);

    // 将原有的 speakText 和 doSpeak 替换为以下代码

    // TTS 语音合成 - 防止循环朗读
    const speakText = (text) => {
        if (!window.speechSynthesis) {
            console.warn('浏览器不支持语音合成');
            return;
        }

        // 先完全停止当前朗读
        window.speechSynthesis.cancel();

        // 清除之前的定时器
        if (speakTimeoutRef.current) {
            clearTimeout(speakTimeoutRef.current);
        }

        // 重置状态
        isSpeakingRef.current = false;
        setIsSpeaking(false);

        // 延迟后开始新朗读，确保取消完成
        speakTimeoutRef.current = setTimeout(() => {
            doSpeak(text);
            speakTimeoutRef.current = null;
        }, 50);
    };

    const doSpeak = (text) => {
        // 提取英文内容
        let plainText = text;

        // 移除 Markdown 标记
        plainText = plainText.replace(/\*\*([^*]+)\*\*/g, '$1');
        plainText = plainText.replace(/\*([^*]+)\*/g, '$1');
        plainText = plainText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        plainText = plainText.replace(/`([^`]+)`/g, '$1');
        plainText = plainText.replace(/```[\s\S]*?```/g, '');
        plainText = plainText.replace(/^#{1,6}\s+/gm, '');

        // 提取英文句子
        const englishSentences = plainText.match(/[A-Z][A-Za-z\s,;:()'"!?.-]+[.!?]/g);

        if (englishSentences && englishSentences.length > 0) {
            plainText = englishSentences.join(' ');
        } else {
            plainText = plainText.replace(/[^A-Za-z0-9\s,.!?'-]/g, '');
        }

        plainText = plainText.replace(/\s+/g, ' ').trim();

        console.log('TTS 朗读文本:', plainText);

        if (!plainText) {
            console.warn('没有可朗读的英文内容');
            return;
        }

        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            console.log('TTS 开始朗读');
            isSpeakingRef.current = true;
            setIsSpeaking(true);
        };

        utterance.onend = () => {
            console.log('TTS 朗读结束');
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            utteranceRef.current = null;
        };

        utterance.onerror = (e) => {
            console.error('TTS 错误:', e);
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            utteranceRef.current = null;
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    };

    // 停止语音
    const stopSpeaking = () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    // 处理句子（最终结果）
    const handleSentence = (sentence, isFinal) => {
        console.log('=== handleSentence ===', sentence, isFinal);
        if (isFinal && sentence) {
            setSentences(prev => {
                const newSentences = [...prev, sentence];
                const fullText = newSentences.join(' ');
                setFullTranscript(fullText);
                finalTranscriptRef.current = fullText;
                return newSentences;
            });
            setCurrentInterim('');
        }
    };

    // 处理中间结果（实时预览）
    const handleTranscript = (text, isFinal) => {
        if (!isFinal) {
            setCurrentInterim(text);
        }
    };

    // 清空对话
    const clearConversation = () => {
        setSentences([]);
        setCurrentInterim('');
        setFullTranscript('');
        setAiResponse('');
        finalTranscriptRef.current = '';
        setAudioUrl(null);
        audioChunksRef.current = [];
        stopSpeaking();
    };

    // 清空历史记录
    const clearHistory = () => {
        setConversationHistory([]);
        clearConversation();
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

    // AI 分析（支持场景化对话）
    const analyzeWithAI = async () => {
        const currentTranscript = fullTranscript || sentences.join(' ');
        if (!currentTranscript.trim()) {
            alert('请先录音说出你的回答');
            return;
        }

        setLoading(true);
        
        // 构建提示词（根据模式不同）
        let analysisPrompt;
        // 在 analyzeWithAI 函数中，修改对话模式的 prompt
        if (isConversationMode && selectedScenario) {
            const historyText = conversationHistory.map(h => 
                `${h.role === 'user' ? 'Student' : 'AI'}: ${h.content}`
            ).join('\n');

            analysisPrompt = `${selectedScenario.systemPrompt}

        ${historyText ? `Conversation history:\n${historyText}\n` : ''}
        Student said: ${currentTranscript}

        IMPORTANT: 
        1. Respond in plain English only (no markdown, no bold, no asterisks)
        2. Keep your response short (1-2 sentences maximum)
        3. Be natural and conversational, like a real person
        4. Don't repeat what the student said, just respond naturally

        Your response:`;
        } else {
            // 评分模式
            analysisPrompt = `你是雅思考官。评分学生回答：

话题：${selectedTopic?.question || '口语练习'}
回答：${currentTranscript}

输出格式（Markdown）：

**评分：** 流利度 X/9 | 语法 X/9 | 词汇 X/9 | 发音 X/9

**优点：** 简洁列出
**改进：** 简洁列出
**高分范例：** 简短范例回答

**语法修正：** 如有错误，给出修正`;
        }

        try {
            const model = localStorage.getItem('english_model_fast') || 'qwen2.5:7b';
            
            const response = await axios.post(`${API_BASE}/api/ai/ask`, {
                subject: 'english',
                question: analysisPrompt,
                model: model
            });

            if (response.data.success) {
                const aiMessage = response.data.answer;
                setAiResponse(aiMessage);

                // 添加到对话历史
                setConversationHistory(prev => [
                    ...prev,
                    { role: 'user', content: currentTranscript, timestamp: new Date() },
                    { role: 'ai', content: aiMessage, timestamp: new Date() }
                ]);

                // 删除自动朗读部分（注释掉）
                // if (isConversationMode) {
                //     setTimeout(() => {
                //         speakText(aiMessage);
                //     }, 100);
                // }

                // 清空当前句子
                if (isConversationMode) {
                    setSentences([]);
                    setFullTranscript('');
                    finalTranscriptRef.current = '';
                }
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

    // 开始对话模式
    const startConversation = (scenario) => {
        setSelectedScenario(scenario);
        setIsConversationMode(true);
        setConversationHistory([]);
        clearConversation();
        
        // 生成开场白
        const openingPrompt = `${scenario.systemPrompt}\n\n请用英文说一句开场白，开始对话。`;
        
        axios.post(`${API_BASE}/api/ai/ask`, {
            subject: 'english',
            question: openingPrompt,
            model: localStorage.getItem('english_model_fast') || 'qwen2.5:7b'
        }).then(response => {
            if (response.data.success) {
                const opening = response.data.answer;
                setAiResponse(opening);
                setConversationHistory([{ role: 'ai', content: opening, timestamp: new Date() }]);
                // speakText(opening);
            }
        }).catch(err => console.error('开场白生成失败:', err));
    };

    // 退出对话模式
    const exitConversationMode = () => {
        setIsConversationMode(false);
        setSelectedScenario(null);
        setConversationHistory([]);
        clearConversation();
        stopSpeaking();
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
            <h1>🎤 口语练习</h1>
            
            {/* 模式切换 */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px',
                borderBottom: '1px solid #e8e8e8',
                paddingBottom: '12px'
            }}>
                <button
                    onClick={() => {
                        setIsConversationMode(false);
                        setSelectedScenario(null);
                        clearConversation();
                        stopSpeaking();
                    }}
                    style={{
                        padding: '8px 20px',
                        background: !isConversationMode ? '#1890ff' : '#f0f0f0',
                        color: !isConversationMode ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: 'pointer'
                    }}
                >
                    📝 雅思评分模式
                </button>
                <button
                    onClick={() => {
                        if (isConversationMode) {
                            exitConversationMode();
                        } else {
                            setIsConversationMode(true);
                        }
                    }}
                    style={{
                        padding: '8px 20px',
                        background: isConversationMode ? '#52c41a' : '#f0f0f0',
                        color: isConversationMode ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: 'pointer'
                    }}
                >
                    💬 场景对话模式
                </button>
            </div>

            {/* 场景选择（对话模式） */}
            {isConversationMode && !selectedScenario && (
                <div style={{ marginBottom: '24px' }}>
                    <h3>🎭 选择对话场景</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                        {scenarios.map(scenario => (
                            <button
                                key={scenario.id}
                                onClick={() => startConversation(scenario)}
                                style={{
                                    padding: '10px 20px',
                                    background: '#f0f0f0',
                                    border: '1px solid #ddd',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <span style={{ fontSize: '20px' }}>{scenario.icon}</span>
                                {scenario.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 当前场景/话题显示 */}
            {isConversationMode && selectedScenario && (
                <div style={{
                    background: '#e6f7ff',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div>
                        <span style={{ fontSize: '24px', marginRight: '8px' }}>{selectedScenario.icon}</span>
                        <strong>{selectedScenario.name}</strong>
                        <span style={{ fontSize: '12px', color: '#666', marginLeft: '12px' }}>
                            {isSpeaking ? '🔊 AI 正在说话...' : '🎙️ 轮到你说话了'}
                        </span>
                    </div>
                    <button
                        onClick={exitConversationMode}
                        style={{
                            padding: '4px 12px',
                            background: '#f0f0f0',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        退出
                    </button>
                </div>
            )}

            {/* 话题选择（评分模式） */}
            {!isConversationMode && (
                <div style={{ marginBottom: '24px' }}>
                    <h3>📋 选择话题</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {topics.map(topic => (
                            <button
                                key={topic.id}
                                onClick={() => {
                                    setSelectedTopic(topic);
                                    clearConversation();
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
            )}

            {/* 当前话题/场景显示 */}
            {!isConversationMode && selectedTopic && (
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

            {/* 对话历史（对话模式） */}
            {isConversationMode && conversationHistory.length > 0 && (
                <div style={{
                    background: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    maxHeight: '300px',
                    overflow: 'auto'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>💬 对话记录</div>
                    {conversationHistory.map((msg, idx) => (
                        <div key={idx} style={{
                            marginBottom: '12px',
                            textAlign: msg.role === 'user' ? 'right' : 'left'
                        }}>
                            <div style={{
                                display: 'inline-block',
                                maxWidth: '80%',
                                padding: '8px 12px',
                                borderRadius: '12px',
                                background: msg.role === 'user' ? '#1890ff' : '#ffffff',
                                color: msg.role === 'user' ? 'white' : '#333',
                                border: msg.role === 'user' ? 'none' : '1px solid #ddd'
                            }}>
                                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
                                    {msg.role === 'user' ? '你' : 'AI'}
                                </div>
                                <div style={{ fontSize: '14px' }}>{msg.content}</div>
                            </div>
                        </div>
                    ))}
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
                    onSentence={handleSentence}
                    onRecordingStart={handleRecordingStart}
                    onRecordingStop={handleRecordingStop}
                    disabled={(!isConversationMode && !selectedTopic) || (isConversationMode && !selectedScenario)}
                />
                
                <AudioDebugger isRecording={isRecording} />
                
                {audioUrl && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>🎵 录音回放</div>
                        <audio controls src={audioUrl} style={{ width: '100%', maxWidth: '300px' }} />
                    </div>
                )}
            </div>

            {/* 识别结果 */}
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
                        {currentInterim && <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>（识别中...）</span>}
                    </div>
                    {(sentences.length > 0 || fullTranscript) && (
                        <button
                            onClick={clearConversation}
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
                
                {sentences.length > 0 ? (
                    sentences.map((s, idx) => (
                        <div key={idx} style={{ marginBottom: '6px', fontSize: '14px', lineHeight: '1.5' }}>
                            <span style={{ color: '#1890ff', fontWeight: 'bold', marginRight: '8px' }}>{idx + 1}.</span>
                            {s}
                        </div>
                    ))
                ) : (
                    <div style={{ fontSize: '14px', color: '#999', minHeight: '40px' }}>
                        {currentInterim || (isConversationMode ? '按住空格键开始对话...' : '按住空格键开始录音...')}
                    </div>
                )}
                
                {currentInterim && sentences.length > 0 && (
                    <div style={{ 
                        color: '#999', 
                        fontStyle: 'italic', 
                        fontSize: '13px', 
                        marginTop: '8px', 
                        borderTop: '1px dashed #d9d9d9', 
                        paddingTop: '8px' 
                    }}>
                        {currentInterim}
                    </div>
                )}
            </div>

            {/* AI 分析/回复按钮 */}
            {(fullTranscript || sentences.length > 0) && !loading && (
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
                        {isConversationMode ? '💬 发送回复' : '🤖 AI 分析回答'}
                    </button>
                    {isSpeaking && (
                        <button
                            onClick={() => {
                                window.speechSynthesis.cancel();
                                isSpeakingRef.current = false;
                                setIsSpeaking(false);
                                if (utteranceRef.current) {
                                    utteranceRef.current = null;
                                }
                                if (speakTimeoutRef.current) {
                                    clearTimeout(speakTimeoutRef.current);
                                    speakTimeoutRef.current = null;
                                }
                            }}
                            style={{
                                marginLeft: '12px',
                                padding: '10px 20px',
                                background: '#ff4d4f',
                                color: 'white',
                                border: 'none',
                                borderRadius: '30px',
                                cursor: 'pointer'
                            }}
                        >
                            ⏹️ 停止朗读
                        </button>
                    )}
                </div>
            )}

            {loading && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#1890ff' }}>
                    {isConversationMode ? '🤖 AI 思考中...' : '🤖 AI 分析中，请稍候...'}
                </div>
            )}

            {/* AI 反馈/回复 */}
            {aiResponse && (
                <div style={{
                    background: '#f5f5f5',
                    padding: '20px',
                    borderRadius: '8px',
                    marginTop: '20px'
                }}>
                    <h3>{isConversationMode ? '🤖 AI 回复' : '🤖 AI 反馈'}</h3>
                    <div className="markdown-body" style={{ 
                        fontSize: '14px', 
                        lineHeight: '1.6',
                        wordBreak: 'break-word',      // 强制换行
                        whiteSpace: 'normal',         // 允许换行
                        overflowWrap: 'break-word'    // 长单词换行
                    }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {aiResponse}
                        </ReactMarkdown>
                    </div>
                    {!isSpeaking && (
                        <button
                            onClick={() => speakText(aiResponse)}
                            style={{
                                marginTop: '12px',
                                padding: '6px 16px',
                                background: '#1890ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            🔊 重新朗读
                        </button>
                    )}
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
                    <li><strong>雅思评分模式</strong>：选择话题 → 录音 → AI 给出评分和改进建议</li>
                    <li><strong>场景对话模式</strong>：选择场景 → 与 AI 进行英文对话 → AI 会语音回复</li>
                    <li>按住空格键开始录音，松开自动结束识别</li>
                    <li>AI 会自动朗读回复，实现真正的对话练习</li>
                </ul>
            </div>
        </div>
    );
}

export default SpeakingPractice;