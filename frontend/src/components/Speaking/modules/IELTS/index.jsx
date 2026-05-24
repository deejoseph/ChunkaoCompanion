import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceRecorder from '../../VoiceRecorder';
import Part1Panel from './Part1Panel';
import Part2Panel from './Part2Panel';
import Part3Panel from './Part3Panel';
import { getRandomPart1Question, getRandomPart2Topic, getPart3Questions } from './topics';
import AIReference from '../../shared/AIReference';

const API_BASE = 'http://localhost:3001';

function IELTSSpeaking({ recognitionEngine, setRecognitionEngine }) {
    // ========== 状态（与通用口语完全一致） ==========
    const [showAIReference, setShowAIReference] = useState(false);
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
    const [currentPart, setCurrentPart] = useState(1);
    const [part1Question, setPart1Question] = useState(null);
    const [part2Topic, setPart2Topic] = useState(null);
    const [part3Data, setPart3Data] = useState(null);
    const [part3Index, setPart3Index] = useState(0);
    
    // Refs
    const audioUrlRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const utteranceRef = useRef(null);
    const isProcessingRef = useRef(false);

    // 获取当前问题（用于 AI 参考答案）
    const getCurrentQuestionText = () => {
        if (currentPart === 1 && part1Question) return part1Question.question;
        if (currentPart === 2 && part2Topic) return part2Topic.title;
        if (currentPart === 3 && part3Data) return part3Data.questions[part3Index];
        return '';
    };

    // ========== Whisper 识别函数（与通用口语相同） ==========
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

    // ========== 统一的音频处理（与通用口语相同） ==========
    const handleAudioBlob = (blob, audioUrl, options = {}) => {
        console.log('收到音频 Blob，保存用于回放, engine:', recognitionEngine);

        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
        }
        setAudioUrl(audioUrl);
        audioUrlRef.current = audioUrl;

        if (!options.transcribe) {
            setRecognitionStatus('快速模式已完成录音，浏览器实时识别结果可直接修改后提交');
            return;
        }

        transcribeWithWhisper(blob, 'small');
    };

    // ========== 快速模式的实时识别回调 ==========
    const handleTranscript = (text, isFinal) => {
        if (!isFinal) {
            setCurrentInterim(text);
            setRecognitionStatus('浏览器实时识别中...');
            return;
        }
        if (text) {
            setSentences(prev => [...prev, text]);
            setFullTranscript(prev => prev + (prev ? ' ' : '') + text);
            finalTranscriptRef.current = fullTranscript + (fullTranscript ? ' ' : '') + text;
            setRecognitionStatus('快速识别完成，可直接修改文本');
        }
    };

    const handleSentence = (sentence, isFinal) => {
        // 兼容保留
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
    };

    const handleRecordingStart = () => {
        console.log('开始录音');
        setIsRecording(true);
        setRecognitionStatus(recognitionEngine === 'whisper' ? '录音中，松开后开始精准识别' : '录音中，浏览器实时识别');
        setCurrentInterim('');
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        setAudioUrl(null);
    };

    const handleRecordingStop = () => {
        console.log('停止录音');
        setIsRecording(false);
        if (recognitionEngine === 'whisper') {
            setRecognitionStatus('录音已结束，正在准备识别...');
        }
    };

    // ========== AI 评分（基于 sentences/fullTranscript） ==========
    const analyzeWithAI = async () => {
        const currentTranscript = fullTranscript || sentences.join(' ');
        if (!currentTranscript.trim()) {
            alert('请先录音说出你的回答');
            return;
        }
        setLoading(true);
        let analysisPrompt = '';
        if (currentPart === 1 && part1Question) {
            analysisPrompt = `你是雅思考官。请对以下 Part 1 回答进行评分：

话题：${part1Question.topic}
问题：${part1Question.question}
回答：${currentTranscript}

输出格式（Markdown）：

**评分：** 流利度 X/9 | 语法 X/9 | 词汇 X/9 | 发音 X/9

**优点：** （2-3点）
**改进：** （2-3点）
**高分范例：** （简短范例回答）`;
        } else if (currentPart === 2 && part2Topic) {
            analysisPrompt = `你是雅思考官。请对以下 Part 2 个人陈述进行评分：

话题：${part2Topic.title}
要求：${part2Topic.prompts.join('、')}
回答：${currentTranscript}

输出格式（Markdown）：

**评分：** 流利度 X/9 | 语法 X/9 | 词汇 X/9 | 发音 X/9

**优点：** （2-3点）
**改进：** （2-3点）
**结构评价：** （清晰的开头/主体/结尾）
**示范回答要点：**`;
        } else if (currentPart === 3 && part3Data) {
            analysisPrompt = `你是雅思考官。请对以下 Part 3 抽象话题讨论进行评分：

话题类别：${part3Data.category}
问题：${part3Data.questions[part3Index]}
回答：${currentTranscript}

输出格式（Markdown）：

**评分：** 流利度 X/9 | 语法 X/9 | 词汇 X/9 | 发音 X/9

**优点：** （2-3点）
**改进：** （2-3点）
**逻辑评价：** （清晰的论点和支持细节）
**示范回答：**`;
        }
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
        }
        setLoading(false);
    };

    // ========== Part 切换与题目加载 ==========
    useEffect(() => {
        if (currentPart === 1 && !part1Question) {
            setPart1Question(getRandomPart1Question());
        }
        if (currentPart === 2 && !part2Topic) {
            setPart2Topic(getRandomPart2Topic());
        }
    }, [currentPart]);

    const switchPart = (part) => {
        setCurrentPart(part);
        clearConversation();
        if (part === 1 && !part1Question) setPart1Question(getRandomPart1Question());
        if (part === 2 && !part2Topic) setPart2Topic(getRandomPart2Topic());
        if (part === 3 && !part3Data) {
            const data = getPart3Questions('education');
            setPart3Data(data);
            setPart3Index(0);
        }
    };

    const loadNewPart1 = () => {
        setPart1Question(getRandomPart1Question());
        clearConversation();
    };
    const loadNewPart2 = () => {
        setPart2Topic(getRandomPart2Topic());
        clearConversation();
    };
    const nextPart3 = () => {
        if (part3Data && part3Index < part3Data.questions.length - 1) {
            setPart3Index(part3Index + 1);
            clearConversation();
        }
    };
    const prevPart3 = () => {
        if (part3Index > 0) {
            setPart3Index(part3Index - 1);
            clearConversation();
        }
    };

    // TTS 语音合成（与通用口语相同，可省略但保留以支持朗读）
    const speakText = (text) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`]/g, ''));
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
            <h1>🎙️ 雅思口语专项练习</h1>

            {/* 备考提示 */}
            <div style={{
                background: '#e6f7ff',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #91d5ff',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
            }}>
                <span style={{ fontSize: '24px' }}>💡</span>
                <div>
                    <strong>备考提示：</strong> 建议在手边准备便签纸，养成1分钟写草稿的习惯。
                    详细的应试技巧可以在 <strong>🌍 国际</strong> 模块中学习加州大学的雅思准备教程。
                </div>
            </div>

            {/* Part 切换 */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '24px',
                borderBottom: '1px solid #e8e8e8',
                paddingBottom: '12px'
            }}>
                <button onClick={() => switchPart(1)} style={{
                    padding: '10px 24px',
                    background: currentPart === 1 ? '#1890ff' : '#f0f0f0',
                    color: currentPart === 1 ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}>📝 Part 1</button>
                <button onClick={() => switchPart(2)} style={{
                    padding: '10px 24px',
                    background: currentPart === 2 ? '#52c41a' : '#f0f0f0',
                    color: currentPart === 2 ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}>🎤 Part 2</button>
                <button onClick={() => switchPart(3)} style={{
                    padding: '10px 24px',
                    background: currentPart === 3 ? '#fa8c16' : '#f0f0f0',
                    color: currentPart === 3 ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}>💬 Part 3</button>
            </div>

            {/* 题目面板 + AI参考答案按钮 */}
            {currentPart === 1 && part1Question && (
                <>
                    <Part1Panel question={part1Question} onNextQuestion={loadNewPart1} />
                    <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                        <button
                            onClick={() => setShowAIReference(true)}
                            style={{ padding: '8px 20px', background: '#722ed1', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '14px' }}
                        >
                            🤖 查看 AI 参考答案
                        </button>
                    </div>
                </>
            )}
            {currentPart === 2 && part2Topic && (
                <>
                    <Part2Panel topic={part2Topic} onPreparationStart={() => {}} onSpeakingStart={() => {}} onStopSpeaking={() => {}} />
                    <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                        <button
                            onClick={() => setShowAIReference(true)}
                            style={{ padding: '8px 20px', background: '#722ed1', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '14px' }}
                        >
                            🤖 查看 AI 参考答案
                        </button>
                    </div>
                </>
            )}
            {currentPart === 3 && part3Data && (
                <>
                    <Part3Panel questions={part3Data.questions} currentIndex={part3Index} onNext={nextPart3} onPrev={prevPart3} />
                    <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                        <button
                            onClick={() => setShowAIReference(true)}
                            style={{ padding: '8px 20px', background: '#722ed1', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '14px' }}
                        >
                            🤖 查看 AI 参考答案
                        </button>
                    </div>
                </>
            )}

            {/* AI 参考答案弹窗 */}
            {showAIReference && (
                <AIReference
                    currentQuestion={getCurrentQuestionText()}
                    context="ielts"
                    onClose={() => setShowAIReference(false)}
                />
            )}

            {/* ========== 录音区域（与通用口语完全相同） ========== */}
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
                    disabled={false}
                />
                {audioUrl && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>🎵 录音回放</div>
                        <audio controls src={audioUrl} style={{ width: '100%', maxWidth: '300px' }} />
                    </div>
                )}
            </div>

            {/* ========== 识别结果（与通用口语完全相同） ========== */}
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
                        {currentInterim || '按住空格键开始录音...'}
                    </div>
                )}

                {(fullTranscript || sentences.length > 0) && (
                    <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>可在提交前修正识别文本</div>
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

            {/* AI 评分按钮 */}
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
                        🤖 AI 评分与分析
                    </button>
                    {aiResponse && (
                        <button
                            onClick={() => speakText(aiResponse)}
                            style={{
                                marginLeft: '12px',
                                padding: '6px 16px',
                                background: '#1890ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            🔊 朗读反馈
                        </button>
                    )}
                </div>
            )}

            {loading && <div style={{ textAlign: 'center', padding: '20px', color: '#1890ff' }}>🤖 AI 评分中，请稍候...</div>}
            {transcribing && <div style={{ textAlign: 'center', padding: '16px', color: '#1890ff' }}>🎧 正在识别录音，请稍候...</div>}

            {aiResponse && (
                <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
                    <h3>📊 AI 评分与反馈</h3>
                    <div className="markdown-body" style={{ fontSize: '14px', lineHeight: '1.6', wordBreak: 'break-word' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* 使用说明 */}
            <div style={{ marginTop: '24px', padding: '16px', background: '#fff7e6', borderRadius: '8px', border: '1px solid #ffc53d' }}>
                <strong>💡 雅思口语考试说明：</strong>
                <ul style={{ margin: '8px 0 0 20px', lineHeight: '1.6' }}>
                    <li>Part 1：日常话题，2-3句话回答</li>
                    <li>Part 2：1分钟准备 + 2分钟陈述，涵盖所有要点</li>
                    <li>Part 3：抽象话题，表达观点并举例</li>
                    <li>按住空格键开始录音，松开自动结束识别</li>
                    <li>识别后可以手动修正文本，再提交AI评分</li>
                </ul>
            </div>
        </div>
    );
}

export default IELTSSpeaking;