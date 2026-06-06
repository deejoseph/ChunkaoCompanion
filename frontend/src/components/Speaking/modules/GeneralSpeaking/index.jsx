import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceRecorder from '../../VoiceRecorder';
import AudioDebugger from '../../AudioDebugger';
import AIReference from '../../shared/AIReference';
import { useTopics } from '../../shared/useTopics';
import AddTopicModal from '../../shared/AddTopicModal';

const API_BASE = 'http://localhost:3001';

// 内置话题（静态）
const BUILTIN_TOPICS = [
    { id: 1, question: "Do you like reading books? Why or why not?", category: "Hobby" },
    { id: 2, question: "What kind of music do you enjoy listening to?", category: "Music" },
    { id: 3, question: "Do you prefer to work or study alone or with others?", category: "Study" },
    { id: 4, question: "How often do you use the internet?", category: "Technology" },
    { id: 5, question: "What's your favorite season and why?", category: "Weather" },
    { id: 6, question: "Do you like to travel? Why or why not?", category: "Travel" },
    { id: 7, question: "What sports do you enjoy playing or watching?", category: "Sports" },
    { id: 8, question: "How do you usually celebrate festivals?", category: "Culture" },
    { id: 9, question: "Describe a person who has influenced you.", category: "People" },
    { id: 10, question: "What is your favorite movie and why?", category: "Entertainment" },
    { id: 11, question: "Do you prefer city life or country life?", category: "Lifestyle" },
    { id: 12, question: "What are the benefits of learning a foreign language?", category: "Education" }
];

function GeneralSpeaking({ recognitionEngine, setRecognitionEngine }) {
    // 状态
    const [showAIReference, setShowAIReference] = useState(false);
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
    const [transcribing, setTranscribing] = useState(false);
    const [recognitionStatus, setRecognitionStatus] = useState('');
    const [lastTranscribeTime, setLastTranscribeTime] = useState(null);
    const [answerTargetSeconds, setAnswerTargetSeconds] = useState(45);
    
    // Refs
    const audioUrlRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const utteranceRef = useRef(null);
    const isProcessingRef = useRef(false);
    const currentInterimRef = useRef('');   // 追踪快速模式中间识别结果
    const sentencesRef = useRef([]);        // 追踪已确认的句子
    
    // 添加话题模态框
    const [showAddTopicModal, setShowAddTopicModal] = useState(false);
    // 使用 hook 管理话题（内置 + 自定义）
    const { topics, addTopic } = useTopics(BUILTIN_TOPICS, 'general_speaking_custom_topics');

    // 场景预设
    const scenarios = [
        { id: 'general', name: '💬 日常对话', icon: '💬', systemPrompt: '你是一位朋友，正在和朋友聊天。请用英文对话，轻松自然。' },
        { id: 'interview', name: '💼 求职面试', icon: '💼', systemPrompt: '你是一位面试官，正在面试一位应聘者。请用英文提问，问题要专业但友好。' },
        { id: 'visa', name: '🛂 签证面试', icon: '🛂', systemPrompt: '你是一位签证官，正在面试申请签证的人。请用英文提问，问题要正式但礼貌。' },
        { id: 'business', name: '📊 商务会议', icon: '📊', systemPrompt: '你是一位商务合作伙伴，正在讨论合作事宜。请用英文交流，语气专业。' },
        { id: 'shopping', name: '🛍️ 购物', icon: '🛍️', systemPrompt: '你是一位商店店员，正在帮助顾客。请用英文对话，友好热情。' },
        { id: 'travel', name: '✈️ 旅游', icon: '✈️', systemPrompt: '你是一位当地导游，正在和游客聊天。请用英文对话，介绍当地风情。' },
        { id: 'cafe', name: '☕ 咖啡厅', icon: '☕', systemPrompt: '你是一位咖啡厅店员，正在接待顾客。请用英文对话，轻松自然。' }
    ];

    const [selectedScenario, setSelectedScenario] = useState(null);

    // Whisper 识别函数
    const transcribeWithWhisper = async (audioBlob, modelSize = 'small') => {
        if (isProcessingRef.current) {
            console.log('Whisper 识别中，跳过重复调用');
            return;
        }

        isProcessingRef.current = true;
        setTranscribing(true);
        const startedAt = performance.now();
        setLastTranscribeTime(null);
        setRecognitionStatus(modelSize === 'small' ? '精准识别中，首次加载模型会稍慢...' : '快速识别中...');

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('model_size', modelSize);
        formData.append('language', 'en');

        try {
            const response = await axios.post('http://localhost:3001/api/whisper/transcribe', formData);
            if (response.data.success) {
                setSentences([]);
                const segments = response.data.segments || [];
                const newSentences = segments.map(s => s.text.trim()).filter(Boolean);
                setSentences(newSentences);
                const fullText = response.data.text || newSentences.join(' ');
                setFullTranscript(fullText);
                finalTranscriptRef.current = fullText;
                setCurrentInterim('');
                const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
                setLastTranscribeTime(elapsed);
                setRecognitionStatus(`识别完成：${response.data.model_size || modelSize} 模型，用时 ${elapsed} 秒`);
                console.log(`Whisper 识别完成: ${newSentences.length} 个句子, 模型: ${modelSize}`);
            } else {
                console.error('Whisper 识别失败:', response.data.error);
                setSentences(['识别失败，请重试']);
                setFullTranscript('识别失败，请重试');
                setRecognitionStatus('识别失败，请重试或切换快速模式');
            }
        } catch (error) {
            console.error('Whisper 请求失败:', error);
            setSentences(['服务未响应，请检查后端']);
            setFullTranscript('服务未响应，请检查后端');
            setRecognitionStatus('Whisper 服务未响应，请检查后端或切换快速模式');
        } finally {
            setTranscribing(false);
            isProcessingRef.current = false;
        }
    };

    const handleAudioBlob = (blob, audioUrl, options = {}) => {
        console.log('收到音频 Blob，保存用于回放, engine:', recognitionEngine);

        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
        }
        setAudioUrl(audioUrl);
        audioUrlRef.current = audioUrl;

        if (!options.transcribe) {
            // 快速模式：录音结束后，将未 finalize 的中间识别结果合并到 fullTranscript
            const interimText = currentInterimRef.current.trim();
            if (interimText && !finalTranscriptRef.current.includes(interimText)) {
                const existing = finalTranscriptRef.current || sentencesRef.current.join(' ');
                const combined = existing ? `${existing} ${interimText}`.trim() : interimText;
                setFullTranscript(combined);
                finalTranscriptRef.current = combined;
                const newSentences = [...sentencesRef.current, interimText];
                setSentences(newSentences);
                sentencesRef.current = newSentences;
                setCurrentInterim('');
                currentInterimRef.current = '';
            }
            setRecognitionStatus('快速模式已完成录音，识别结果可直接修改后提交');
            return;
        }

        transcribeWithWhisper(blob, 'small');
    };

    const speakText = (text) => {
        if (!window.speechSynthesis) {
            console.warn('浏览器不支持语音合成');
            return;
        }

        window.speechSynthesis.cancel();

        if (speakTimeoutRef.current) {
            clearTimeout(speakTimeoutRef.current);
        }

        isSpeakingRef.current = false;
        setIsSpeaking(false);

        speakTimeoutRef.current = setTimeout(() => {
            doSpeak(text);
            speakTimeoutRef.current = null;
        }, 50);
    };

    const doSpeak = (text) => {
        let plainText = text;

        plainText = plainText.replace(/\*\*([^*]+)\*\*/g, '$1');
        plainText = plainText.replace(/\*([^*]+)\*/g, '$1');
        plainText = plainText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        plainText = plainText.replace(/`([^`]+)`/g, '$1');
        plainText = plainText.replace(/```[\s\S]*?```/g, '');
        plainText = plainText.replace(/^#{1,6}\s+/gm, '');

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

    const stopSpeaking = () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    const handleSentence = (sentence, isFinal) => {
        console.log('=== handleSentence ===', sentence, isFinal);
        if (isFinal && sentence) {
            setSentences(prev => {
                const newSentences = [...prev, sentence];
                const fullText = newSentences.join(' ');
                setFullTranscript(fullText);
                finalTranscriptRef.current = fullText;
                sentencesRef.current = newSentences;
                return newSentences;
            });
            setCurrentInterim('');
            currentInterimRef.current = '';
            setRecognitionStatus('快速识别完成，可直接修改文本');
        }
    };

    const handleTranscript = (text, isFinal) => {
        if (!isFinal) {
            setCurrentInterim(text);
            currentInterimRef.current = text;
            setRecognitionStatus('浏览器实时识别中...');
            return;
        }

        if (text) {
            // Web Speech API 返回了 isFinal 结果，但 handleSentence 可能没被触发
            // （例如只有一段完整文本但没有分段）
            // 确保将结果写入 fullTranscript
            const existing = sentencesRef.current.join(' ');
            const combined = existing ? `${existing} ${text}`.trim() : text;
            setFullTranscript(combined);
            finalTranscriptRef.current = combined;
            if (!sentencesRef.current.includes(text)) {
                setSentences(prev => {
                    const newSentences = [...prev, text];
                    sentencesRef.current = newSentences;
                    return newSentences;
                });
            }
            setCurrentInterim('');
            currentInterimRef.current = '';
            setRecognitionStatus('快速识别完成，可直接修改文本');
        }
    };

    const clearConversation = () => {
        setSentences([]);
        setCurrentInterim('');
        setFullTranscript('');
        setAiResponse('');
        setRecognitionStatus('');
        setLastTranscribeTime(null);
        finalTranscriptRef.current = '';
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
        }
        setAudioUrl(null);
        stopSpeaking();
    };

    const clearHistory = () => {
        setConversationHistory([]);
        clearConversation();
    };

    const handleRecordingStart = () => {
        console.log('开始录音');
        setIsRecording(true);
        setRecognitionStatus(recognitionEngine === 'whisper' ? '录音中，松开后开始精准识别' : '录音中，浏览器实时识别');
        setCurrentInterim('');
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
        }
        setAudioUrl(null);
    };

    const handleRecordingStop = () => {
        console.log('停止录音');
        setIsRecording(false);
        if (recognitionEngine === 'whisper') {
            setRecognitionStatus('录音已结束，正在准备识别...');
        }
    };

    useEffect(() => {
        return () => {
            if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current);
            }
        };
    }, []);

    const startConversation = (scenario) => {
        setSelectedScenario(scenario);
        setIsConversationMode(true);
        setConversationHistory([]);
        clearConversation();
        
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
            }
        }).catch(err => console.error('开场白生成失败:', err));
    };

    const analyzeWithAI = async () => {
        const currentTranscript = fullTranscript || sentences.join(' ');
        if (!currentTranscript.trim()) {
            alert('请先录音说出你的回答');
            return;
        }

        setLoading(true);
        
        let analysisPrompt;
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

                setConversationHistory(prev => [
                    ...prev,
                    { role: 'user', content: currentTranscript, timestamp: new Date() },
                    { role: 'ai', content: aiMessage, timestamp: new Date() }
                ]);

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

    const exitConversationMode = () => {
        setIsConversationMode(false);
        setSelectedScenario(null);
        setConversationHistory([]);
        clearConversation();
        stopSpeaking();
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ margin: 0 }}>🗣️ 通用口语练习</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>支持话题自述和场景对话模式</p>
                </div>
            </div>
            
            {/* 模式切换 */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px',
                borderBottom: '1px solid #e8e8e8',
                paddingBottom: '12px',
                flexWrap: 'wrap'
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
                    🎤 话题自述模式
                </button>
                <button
                    onClick={() => {
                        setIsConversationMode(true);
                        setSelectedScenario(null);
                        clearConversation();
                    }}
                    style={{
                        padding: '8px 20px',
                        background: isConversationMode && !selectedScenario ? '#52c41a' : '#f0f0f0',
                        color: isConversationMode && !selectedScenario ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: 'pointer'
                    }}
                >
                    💬 场景对话模式
                </button>
                <button
                    onClick={() => {
                        setIsConversationMode(true);
                        const visaScenario = scenarios.find(s => s.id === 'visa');
                        if (visaScenario) startConversation(visaScenario);
                    }}
                    style={{
                        padding: '8px 20px',
                        background: isConversationMode && selectedScenario?.id === 'visa' ? '#fa8c16' : '#f0f0f0',
                        color: isConversationMode && selectedScenario?.id === 'visa' ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: 'pointer'
                    }}
                >
                    🛂 签证对话模式
                </button>
            </div>

            {/* 练习时长选择 */}
            {!isConversationMode && (
                <div style={{
                    marginBottom: '20px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    background: '#f7f9fc',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #e6edf5'
                }}>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>练习时长</span>
                    {[30, 45, 60, 90].map(seconds => (
                        <button
                            key={seconds}
                            onClick={() => setAnswerTargetSeconds(seconds)}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '16px',
                                border: 'none',
                                background: answerTargetSeconds === seconds ? '#1890ff' : '#e8e8e8',
                                color: answerTargetSeconds === seconds ? 'white' : '#333',
                                cursor: 'pointer'
                            }}
                        >
                            {seconds}秒
                        </button>
                    ))}
                    <span style={{ fontSize: '13px', color: '#666' }}>
                        建议结构：直接回答 → 给原因 → 举例 → 简短收尾
                    </span>
                </div>
            )}

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

            {/* 当前场景显示 */}
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

            {/* 话题选择（自述模式） */}
            {!isConversationMode && (
                <div style={{ marginBottom: '24px' }}>
                    <h3>📋 选择话题</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <select
                            value={selectedTopic?.id || ''}
                            onChange={(e) => {
                                const topicId = e.target.value;
                                const topic = topics.find(t => String(t.id) === topicId);
                                if (topic) {
                                    setSelectedTopic(topic);
                                    clearConversation();
                                }
                            }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #d9d9d9',
                                fontSize: '14px',
                                minWidth: '220px',
                                cursor: 'pointer',
                                backgroundColor: 'white'
                            }}
                        >
                            <option value="">-- 请选择话题 --</option>
                            {topics.map(topic => (
                                <option key={topic.id} value={topic.id}>
                                    {topic.category} - {topic.question.length > 50 ? topic.question.slice(0, 50) + '...' : topic.question}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => setShowAddTopicModal(true)}
                            style={{
                                padding: '6px 12px',
                                background: '#52c41a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            ➕ 添加话题
                        </button>
                        {selectedTopic && (
                            <button
                                onClick={() => {
                                    setSelectedTopic(null);
                                    clearConversation();
                                }}
                                style={{
                                    padding: '6px 12px',
                                    background: '#f0f0f0',
                                    border: '1px solid #ccc',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                清除选择
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 当前话题显示 */}
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

            {/* AI 参考答案按钮 */}
            {selectedTopic && (
                <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                    <button
                        onClick={() => setShowAIReference(true)}
                        style={{
                            padding: '8px 20px',
                            background: '#722ed1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        🤖 查看 AI 参考答案
                    </button>
                </div>
            )}
            
            {/* AI 参考答案展示区域 - 左对齐 */}
            {showAIReference && selectedTopic && (
                <div style={{ textAlign: 'left' }}>
                    <AIReference
                        currentQuestion={selectedTopic.question}
                        context="general"
                        onClose={() => setShowAIReference(false)}
                    />
                </div>
            )}

            {/* 对话历史 */}
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
                    key={recognitionEngine}
                    onTranscript={handleTranscript}
                    onSentence={handleSentence}
                    onRecordingStart={handleRecordingStart}
                    onRecordingStop={handleRecordingStop}
                    onAudioBlob={handleAudioBlob}
                    transcribeAudio={recognitionEngine === 'whisper'}
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
                        {(currentInterim || transcribing) && <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>（识别中...）</span>}
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
                {recognitionStatus && (
                    <div style={{ fontSize: '12px', color: transcribing ? '#1890ff' : '#666', marginBottom: '8px' }}>
                        {recognitionStatus}
                        {lastTranscribeTime && <span style={{ marginLeft: '8px' }}>最近一次：{lastTranscribeTime}s</span>}
                    </div>
                )}
                
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

                {(fullTranscript || sentences.length > 0) && (
                    <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                            可在提交前修正识别文本
                        </div>
                        <textarea
                            value={fullTranscript}
                            onChange={(e) => {
                                setFullTranscript(e.target.value);
                                finalTranscriptRef.current = e.target.value;
                                setSentences(e.target.value ? [e.target.value] : []);
                            }}
                            rows={4}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '10px',
                                borderRadius: '6px',
                                border: '1px solid #d9d9d9',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                resize: 'vertical'
                            }}
                        />
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
            {(fullTranscript || sentences.length > 0) && !loading && !transcribing && (
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

            {transcribing && (
                <div style={{ textAlign: 'center', padding: '16px', color: '#1890ff' }}>
                    🎧 正在识别录音，请稍候...
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
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        overflowWrap: 'break-word'
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
                    <li><strong>快速模式</strong>：使用浏览器实时识别，适合跟读和日常练习</li>
                    <li><strong>精准模式</strong>：使用本地 Whisper small 模型，适合正式评分</li>
                    <li>两种模式都会保存录音回放，提交前可以手动修正识别文本</li>
                    <li>按住空格键开始录音，松开自动结束</li>
                    <li><strong>话题自述模式</strong>：选择话题后自行陈述，AI将给出评分</li>
                    <li><strong>场景对话模式</strong>：与AI进行角色扮演对话</li>
                    <li><strong>自定义话题</strong>：点击「➕ 添加话题」可添加自己的练习题目，保存在浏览器中</li>
                </ul>
            </div>

            {/* 添加话题模态框 */}
            <AddTopicModal
                isOpen={showAddTopicModal}
                onClose={() => setShowAddTopicModal(false)}
                onAdd={addTopic}
            />
        </div>
    );
}

export default GeneralSpeaking;