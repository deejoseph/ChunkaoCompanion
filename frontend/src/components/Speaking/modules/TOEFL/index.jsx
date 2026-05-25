// frontend/src/components/Speaking/modules/TOEFL/index.jsx
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceRecorder from '../../VoiceRecorder';
import AudioDebugger from '../../AudioDebugger';
import { useTOEFLTopics } from '../../shared/useTOEFLTopics';
import AddTOEFLTopicModal from './AddTOEFLTopicModal';
import AIReference from '../../shared/AIReference';  // 新增

const API_BASE = 'http://localhost:3001';

// 内置托福题目库
const BUILTIN_TOPICS = [
    // Task 1
    {
        id: 1,
        taskType: 1,
        taskName: '独立口语',
        question: 'Some people prefer to take risks and try new things. Others prefer to avoid risks and stay safe. Which do you think is better? Use details and examples to explain your opinion.',
        preparationTime: 15,
        responseTime: 45,
        reading: null,
        listening: null
    },
    {
        id: 2,
        taskType: 1,
        taskName: '独立口语',
        question: 'Do you agree or disagree with the following statement? It is important to learn about other cultures. Use specific reasons and examples to support your answer.',
        preparationTime: 15,
        responseTime: 45,
        reading: null,
        listening: null
    },
    // Task 2
    {
        id: 3,
        taskType: 2,
        taskName: '综合口语 - 校园问题',
        question: 'The woman expresses her opinion about the university\'s plan. State her opinion and explain the reasons she gives for holding that opinion.',
        preparationTime: 30,
        responseTime: 60,
        reading: 'The university has announced that it will replace the campus coffee shop with a new study lounge. The administration believes this will provide more quiet study space for students, as the current coffee shop is often noisy and crowded. Additionally, a new coffee shop will be opened in the student center next semester.',
        listening: 'Man: Did you hear about the coffee shop? Woman: Yes, I think it\'s a terrible idea. That coffee shop is where many students gather to relax between classes. It\'s not supposed to be a library. The new study lounge will just be another quiet place, but we already have the library and several study halls. Also, the new coffee shop in the student center is much smaller and always packed. So we\'ll lose our main social spot.'
    },
    {
        id: 4,
        taskType: 2,
        taskName: '综合口语 - 校园问题',
        question: 'The man expresses his opinion about the proposed change. State his opinion and explain the reasons he gives.',
        preparationTime: 30,
        responseTime: 60,
        reading: 'The university is considering requiring all first-year students to live on campus. The administration argues that this will help freshmen adjust to college life more easily and increase their academic success. They also believe it will build a stronger sense of community among students.',
        listening: 'Woman: What do you think? Man: I totally support it. When I was a freshman, living in the dorm really helped me make friends and find study groups. It\'s easy to get isolated if you live off campus. And about academic success – the dorms have tutoring sessions and quiet hours. I think it\'s a great idea.'
    },
    // Task 3
    {
        id: 5,
        taskType: 3,
        taskName: '综合口语 - 学术讲座',
        question: 'Explain how the examples of horses and antelopes demonstrate the concept of "group behavior and domestication" discussed in the lecture.',
        preparationTime: 30,
        responseTime: 60,
        reading: 'Group behavior in animals can influence their ability to be domesticated. Animals that form strong hierarchical herds are often easier to domesticate because they naturally follow a leader. In contrast, animals that are solitary or form loose, egalitarian groups are more difficult to tame.',
        listening: 'Professor: Let’s look at horses and antelopes. Horses live in herds with a clear social structure – a dominant stallion leads the group. Because they instinctively follow a leader, humans could easily replace that leader and domesticate them. Antelopes, however, form large herds but without a strict hierarchy. When threatened, they scatter in all directions, making it nearly impossible for humans to control them. That’s why we domesticated horses but not antelopes.'
    },
    {
        id: 6,
        taskType: 3,
        taskName: '综合口语 - 学术讲座',
        question: 'Using the examples from the lecture, explain what "signature calls" are and how they are used by animals.',
        preparationTime: 30,
        responseTime: 60,
        reading: 'Signature calls are unique vocalizations that individual animals use to identify themselves. These calls can serve various functions, such as maintaining contact with group members, warning of danger, or attracting mates. Researchers have found signature calls in many species, including birds, dolphins, and primates.',
        listening: 'Professor: Penguins are a great example. Each penguin has a distinct call that its mate and offspring recognize. In a crowded colony, parents can find their chick among thousands by listening for its specific call. Another example is dolphins – they produce signature whistles that function like names. A dolphin will even mimic another dolphin’s whistle to get its attention. So these calls are not just sounds; they’re a form of individual identification.'
    },
    // Task 4
    {
        id: 7,
        taskType: 4,
        taskName: '综合口语 - 讲座总结',
        question: 'Using the examples from the lecture, explain the concept of "mental accounting" and how it affects consumer behavior.',
        preparationTime: 20,
        responseTime: 60,
        reading: null,
        listening: 'Professor: Mental accounting is a concept in behavioral economics. It describes how people treat money differently depending on where it comes from or what it’s intended for. For example, imagine you find $20 on the street. You might be more willing to spend it frivolously than if you had earned that $20 through work. Another example: people often have a "treat" budget and a "necessities" budget. If they save $50 on groceries, they might use that money to buy a luxury item because they mentally label it as "found money." This can lead to irrational spending decisions.'
    },
    {
        id: 8,
        taskType: 4,
        taskName: '综合口语 - 讲座总结',
        question: 'Using the points and examples from the lecture, explain what "urban heat islands" are and how they form.',
        preparationTime: 20,
        responseTime: 60,
        reading: null,
        listening: 'Professor: Urban heat islands are metropolitan areas that are significantly warmer than their surrounding rural areas. This happens because cities replace natural land with asphalt, concrete, and buildings that absorb and retain heat. For instance, during the day, dark roofs and pavement soak up solar radiation. At night, they slowly release that heat, keeping the city warm. Another factor is the lack of vegetation – trees provide shade and cool the air through evaporation. Without them, temperatures rise. In fact, a city can be up to 10 degrees Fahrenheit hotter than nearby rural areas.'
    }
];

function TOEFLSpeaking({ recognitionEngine, setRecognitionEngine }) {
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [aiResponse, setAiResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [sentences, setSentences] = useState([]);
    const [currentInterim, setCurrentInterim] = useState('');
    const [fullTranscript, setFullTranscript] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const isSpeakingRef = useRef(false);
    const speakTimeoutRef = useRef(null);
    const [transcribing, setTranscribing] = useState(false);
    const [recognitionStatus, setRecognitionStatus] = useState('');
    const [lastTranscribeTime, setLastTranscribeTime] = useState(null);
    
    // 计时相关
    const [preparationTimeLeft, setPreparationTimeLeft] = useState(0);
    const [responseTimeLeft, setResponseTimeLeft] = useState(0);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isResponding, setIsResponding] = useState(false);
    const timerIntervalRef = useRef(null);
    
    // 自定义题目
    const [showAddModal, setShowAddModal] = useState(false);
    const { topics, addTopic } = useTOEFLTopics(BUILTIN_TOPICS, 'toefl_custom_topics');
    
    // AI 参考答案
    const [showAIReference, setShowAIReference] = useState(false);
    
    // Refs
    const audioUrlRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const utteranceRef = useRef(null);
    const isProcessingRef = useRef(false);

    const clearTimer = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };

    const startTimers = () => {
        if (!selectedTopic) return;
        clearTimer();
        setPreparationTimeLeft(selectedTopic.preparationTime);
        setResponseTimeLeft(selectedTopic.responseTime);
        setIsPreparing(true);
        setIsResponding(false);
        
        const prepTimer = setInterval(() => {
            setPreparationTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(prepTimer);
                    setIsPreparing(false);
                    setIsResponding(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        
        const respTimer = setInterval(() => {
            setResponseTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(respTimer);
                    setIsResponding(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        
        timerIntervalRef.current = { prep: prepTimer, resp: respTimer };
    };

    const stopTimers = () => {
        if (timerIntervalRef.current) {
            if (timerIntervalRef.current.prep) clearInterval(timerIntervalRef.current.prep);
            if (timerIntervalRef.current.resp) clearInterval(timerIntervalRef.current.resp);
            timerIntervalRef.current = null;
        }
        setIsPreparing(false);
        setIsResponding(false);
        setPreparationTimeLeft(0);
        setResponseTimeLeft(0);
    };

    useEffect(() => {
        return () => clearTimer();
    }, []);

    useEffect(() => {
        if (selectedTopic) {
            stopTimers();
            clearConversation();
        }
    }, [selectedTopic]);

    const transcribeWithWhisper = async (audioBlob, modelSize = 'small') => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        setTranscribing(true);
        const startedAt = performance.now();
        setLastTranscribeTime(null);
        setRecognitionStatus(modelSize === 'small' ? '精准识别中...' : '快速识别中...');
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('model_size', modelSize);
        formData.append('language', 'en');
        try {
            const response = await axios.post(`${API_BASE}/api/whisper/transcribe`, formData);
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
                setRecognitionStatus(`识别完成（${modelSize}）用时 ${elapsed}s`);
            } else {
                throw new Error(response.data.error);
            }
        } catch (error) {
            console.error(error);
            setSentences(['识别失败，请重试']);
            setFullTranscript('识别失败');
            setRecognitionStatus('识别失败');
        } finally {
            setTranscribing(false);
            isProcessingRef.current = false;
        }
    };

    const handleAudioBlob = (blob, url, options = {}) => {
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        setAudioUrl(url);
        audioUrlRef.current = url;
        if (!options.transcribe) return;
        transcribeWithWhisper(blob, 'small');
    };

    const handleSentence = (sentence, isFinal) => {
        if (isFinal && sentence) {
            setSentences(prev => {
                const newSentences = [...prev, sentence];
                const fullText = newSentences.join(' ');
                setFullTranscript(fullText);
                finalTranscriptRef.current = fullText;
                return newSentences;
            });
            setCurrentInterim('');
            setRecognitionStatus('识别完成，可手动修正');
        }
    };

    const handleTranscript = (text, isFinal) => {
        if (!isFinal) {
            setCurrentInterim(text);
            setRecognitionStatus('浏览器实时识别中...');
        } else if (text) {
            setRecognitionStatus('识别完成');
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
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        setAudioUrl(null);
        stopSpeaking();
    };

    const handleRecordingStart = () => {
        setIsRecording(true);
        setRecognitionStatus(recognitionEngine === 'whisper' ? '录音中，松开后识别' : '录音中，实时识别');
        setCurrentInterim('');
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        setAudioUrl(null);
        setFullTranscript('');
        setSentences([]);
        finalTranscriptRef.current = '';
    };

    const handleRecordingStop = () => {
        setIsRecording(false);
        if (recognitionEngine === 'whisper') setRecognitionStatus('录音结束，准备识别...');
    };

    const speakText = (text) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        speakTimeoutRef.current = setTimeout(() => {
            let plainText = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*/g, '');
            const utterance = new SpeechSynthesisUtterance(plainText);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.onstart = () => { isSpeakingRef.current = true; setIsSpeaking(true); };
            utterance.onend = () => { isSpeakingRef.current = false; setIsSpeaking(false); utteranceRef.current = null; };
            utterance.onerror = () => { isSpeakingRef.current = false; setIsSpeaking(false); };
            utteranceRef.current = utterance;
            window.speechSynthesis.speak(utterance);
            speakTimeoutRef.current = null;
        }, 50);
    };

    const stopSpeaking = () => {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
    };

    const analyzeWithAI = async () => {
        const currentTranscript = fullTranscript || sentences.join(' ');
        if (!currentTranscript.trim()) {
            alert('请先录音说出你的回答');
            return;
        }
        setLoading(true);
        const prompt = `你是托福口语评分官。请根据以下标准评分（表达、语言运用、主题发展，每项0-4分），给出总分（0-30分），并提供简短反馈和改进建议。

题目类型：Task ${selectedTopic.taskType} - ${selectedTopic.taskName}
题目：${selectedTopic.question}
${selectedTopic.reading ? `阅读材料：\n${selectedTopic.reading}\n` : ''}
${selectedTopic.listening ? `听力材料：\n${selectedTopic.listening}\n` : ''}
学生回答：${currentTranscript}

输出格式（Markdown）：
**评分：** 表达 X/4 | 语言运用 X/4 | 主题发展 X/4 | 总分 X/30
**优点：** ...
**改进建议：** ...
**范例要点：** （简要示范如何组织答案）`;

        try {
            const model = localStorage.getItem('english_model_fast') || 'qwen2.5:7b';
            const response = await axios.post(`${API_BASE}/api/ai/ask`, {
                subject: 'english',
                question: prompt,
                model: model
            });
            if (response.data.success) setAiResponse(response.data.answer);
            else setAiResponse(`错误: ${response.data.error}`);
        } catch (error) {
            console.error(error);
            setAiResponse(`请求失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // 构建包含阅读/听力的完整问题文本
    const buildFullQuestion = (topic) => {
        let text = topic.question;
        if (topic.reading) {
            text += `\n\n📖 阅读材料：\n${topic.reading}`;
        }
        if (topic.listening) {
            text += `\n\n🎧 听力材料：\n${topic.listening}`;
        }
        return text;
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{ margin: 0 }}>🎙️ 托福口语专项练习</h2>
                    <p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>iBT独立口语 + 综合口语（校园/学术/讲座）</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {/* 左侧：题目选择 */}
                <div style={{ flex: '1 1 300px', background: '#f5f5f5', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ margin: 0 }}>📋 练习题库</h3>
                        <button onClick={() => setShowAddModal(true)} style={{ padding: '4px 12px', background: '#52c41a', color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer' }}>➕ 添加题目</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {topics.map(topic => (
                            <div
                                key={topic.id}
                                onClick={() => { setSelectedTopic(topic); clearConversation(); stopTimers(); }}
                                style={{
                                    padding: 12,
                                    background: selectedTopic?.id === topic.id ? '#e6f7ff' : 'white',
                                    borderRadius: 8,
                                    border: `1px solid ${selectedTopic?.id === topic.id ? '#1890ff' : '#ddd'}`,
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ fontWeight: 'bold', fontSize: 14 }}>{topic.taskName}</div>
                                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{topic.question.slice(0, 80)}...</div>
                                <div style={{ fontSize: 11, marginTop: 6 }}>⏱️ 准备 {topic.preparationTime}s / 答题 {topic.responseTime}s</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 右侧：练习区域 */}
                <div style={{ flex: '2 1 600px' }}>
                    {!selectedTopic ? (
                        <div style={{ textAlign: 'center', padding: 80, color: '#999' }}>
                            <div style={{ fontSize: 48 }}>📚</div>
                            <div>从左侧选择一个托福口语题目开始练习</div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ background: '#e6f7ff', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                                <h3 style={{ margin: '0 0 8px 0' }}>{selectedTopic.taskName}</h3>
                                <div><strong>题目：</strong> {selectedTopic.question}</div>
                                {selectedTopic.reading && (
                                    <details style={{ marginTop: 8 }}>
                                        <summary style={{ cursor: 'pointer', color: '#1890ff' }}>📖 阅读材料</summary>
                                        <div style={{ background: '#fff', padding: 12, borderRadius: 6, marginTop: 8, whiteSpace: 'pre-wrap' }}>{selectedTopic.reading}</div>
                                    </details>
                                )}
                                {selectedTopic.listening && (
                                    <details style={{ marginTop: 8 }}>
                                        <summary style={{ cursor: 'pointer', color: '#fa8c16' }}>🎧 听力材料（摘要）</summary>
                                        <div style={{ background: '#fff', padding: 12, borderRadius: 6, marginTop: 8, whiteSpace: 'pre-wrap' }}>{selectedTopic.listening}</div>
                                    </details>
                                )}
                            </div>

                            {/* AI 参考答案按钮 */}
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
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

                            <div style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                                <button onClick={startTimers} disabled={isPreparing || isResponding} style={{ padding: '8px 20px', background: '#52c41a', color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer' }}>▶️ 开始练习</button>
                                <button onClick={stopTimers} style={{ padding: '8px 20px', background: '#ff4d4f', color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer' }}>⏹️ 停止计时</button>
                                <div style={{ background: '#f0f0f0', padding: '8px 16px', borderRadius: 20 }}>
                                    <span>⏳ 准备: {preparationTimeLeft}s</span> &nbsp;|&nbsp;
                                    <span>🎙️ 答题: {responseTimeLeft}s</span>
                                </div>
                            </div>

                            <div style={{ background: '#fafafa', padding: '30px 20px', borderRadius: 12, textAlign: 'center', marginBottom: 24, border: isRecording ? '2px solid #ff4d4f' : '1px solid #e8e8e8' }}>
                                <VoiceRecorder
                                    key={recognitionEngine}
                                    onTranscript={handleTranscript}
                                    onSentence={handleSentence}
                                    onRecordingStart={handleRecordingStart}
                                    onRecordingStop={handleRecordingStop}
                                    onAudioBlob={handleAudioBlob}
                                    transcribeAudio={recognitionEngine === 'whisper'}
                                    disabled={false}
                                />
                                <AudioDebugger isRecording={isRecording} />
                                {audioUrl && (
                                    <div style={{ marginTop: 16 }}>
                                        <div>🎵 录音回放</div>
                                        <audio controls src={audioUrl} style={{ width: '100%', maxWidth: 300 }} />
                                    </div>
                                )}
                            </div>

                            <div style={{ background: '#f6ffed', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #b7eb8f' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: 8 }}>📝 识别结果 {(currentInterim || transcribing) && <span style={{ fontSize: 12, color: '#999' }}>（识别中...）</span>}</div>
                                {recognitionStatus && <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{recognitionStatus} {lastTranscribeTime && `最近一次：${lastTranscribeTime}s`}</div>}
                                {sentences.length > 0 ? sentences.map((s, idx) => (
                                    <div key={idx} style={{ marginBottom: 6 }}><span style={{ color: '#1890ff', fontWeight: 'bold', marginRight: 8 }}>{idx+1}.</span>{s}</div>
                                )) : <div style={{ color: '#999' }}>{currentInterim || '按住空格键开始录音...'}</div>}
                                {(fullTranscript || sentences.length > 0) && (
                                    <textarea
                                        value={fullTranscript}
                                        onChange={(e) => { setFullTranscript(e.target.value); finalTranscriptRef.current = e.target.value; setSentences(e.target.value ? [e.target.value] : []); }}
                                        rows={4}
                                        style={{ width: '100%', marginTop: 12, padding: 10, borderRadius: 6, border: '1px solid #d9d9d9', resize: 'vertical' }}
                                    />
                                )}
                            </div>

                            {(fullTranscript || sentences.length > 0) && !loading && !transcribing && (
                                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                    <button onClick={analyzeWithAI} style={{ padding: '10px 24px', background: '#52c41a', color: 'white', border: 'none', borderRadius: 30, cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>🤖 AI 评分</button>
                                    {isSpeaking && <button onClick={stopSpeaking} style={{ marginLeft: 12, padding: '10px 20px', background: '#ff4d4f', color: 'white', border: 'none', borderRadius: 30, cursor: 'pointer' }}>⏹️ 停止朗读</button>}
                                </div>
                            )}
                            {loading && <div style={{ textAlign: 'center', padding: 20, color: '#1890ff' }}>🤖 评分中，请稍候...</div>}
                            {transcribing && <div style={{ textAlign: 'center', padding: 16, color: '#1890ff' }}>🎧 识别录音中...</div>}

                            {aiResponse && (
                                <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 8, marginTop: 20 }}>
                                    <h3>🤖 托福考官反馈</h3>
                                    <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.6 }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
                                    </div>
                                    {!isSpeaking && <button onClick={() => speakText(aiResponse)} style={{ marginTop: 12, padding: '6px 16px', background: '#1890ff', color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer' }}>🔊 朗读反馈</button>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 添加题目模态框 */}
            <AddTOEFLTopicModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdd={addTopic} />

            {/* AI 参考答案侧边栏 */}
            {showAIReference && selectedTopic && (
                <div style={{ textAlign: 'left' }}>
                    <AIReference
                        currentQuestion={buildFullQuestion(selectedTopic)}
                        context="toefl"
                        onClose={() => setShowAIReference(false)}
                    />
                </div>
            )}
        </div>
    );
}

export default TOEFLSpeaking;