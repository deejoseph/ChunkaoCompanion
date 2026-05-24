import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceRecorder from '../../VoiceRecorder';
import AudioDebugger from '../../AudioDebugger';
import AIReference from '../../shared/AIReference';

const API_BASE = 'http://localhost:3001';

function IELTSSpeaking({ recognitionEngine, setRecognitionEngine }) {
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
    const [transcribing, setTranscribing] = useState(false);
    const [recognitionStatus, setRecognitionStatus] = useState('');
    const [lastTranscribeTime, setLastTranscribeTime] = useState(null);
    const [answerTargetSeconds, setAnswerTargetSeconds] = useState(45);

    // Refs
    const audioUrlRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const utteranceRef = useRef(null);
    const isProcessingRef = useRef(false);

    // 雅思话题库（下拉菜单用 category 区分）
    const topics = [
        { id: 1, question: "Do you work or are you a student?", category: "Part 1 - Work/Study" },
        { id: 2, question: "What's your hometown like?", category: "Part 1 - Hometown" },
        { id: 3, question: "Do you like reading books? Why/why not?", category: "Part 1 - Hobby" },
        { id: 4, question: "How often do you use the internet?", category: "Part 1 - Technology" },
        { id: 5, question: "Describe a person who has influenced you.", category: "Part 2 - People" },
        { id: 6, question: "Describe a trip you remember well.", category: "Part 2 - Travel" },
        { id: 7, question: "Describe a gift you gave to someone.", category: "Part 2 - Gift" },
        { id: 8, question: "Do you think advertising influences people's buying habits?", category: "Part 3 - Advertising" },
        { id: 9, question: "How has technology changed the way people communicate?", category: "Part 3 - Technology" },
        { id: 10, question: "What are the advantages and disadvantages of living in a big city?", category: "Part 3 - City Life" },
        { id: 11, question: "Do you think education should be free for everyone?", category: "Part 3 - Education" },
        { id: 12, question: "What role does music play in people's lives?", category: "Part 3 - Music" }
    ];

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
            setRecognitionStatus('快速模式已完成录音，浏览器实时识别结果可直接修改后提交');
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

    // 快速模式：浏览器实时识别
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
            setRecognitionStatus('快速识别完成，可直接修改文本');
        }
    };

    const handleTranscript = (text, isFinal) => {
        if (!isFinal) {
            setCurrentInterim(text);
            setRecognitionStatus('浏览器实时识别中...');
            return;
        }

        if (text) {
            setRecognitionStatus('快速识别完成，可直接修改文本');
        }
    };

    // 清空当前会话（识别结果、AI反馈等）
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

    const handleRecordingStart = () => {
        console.log('开始录音');
        setIsRecording(true);
        // 关键修改：每次开始录音时清空之前的所有识别结果
        setSentences([]);
        setFullTranscript('');
        setCurrentInterim('');
        finalTranscriptRef.current = '';
        setRecognitionStatus(recognitionEngine === 'whisper' ? '录音中，松开后开始精准识别' : '录音中，浏览器实时识别');
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
        }
        setAudioUrl(null);
        // 同时清空之前的AI反馈（可选，避免混淆）
        setAiResponse('');
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

    // AI 分析（雅思评分）
    const analyzeWithAI = async () => {
        const currentTranscript = fullTranscript || sentences.join(' ');
        if (!currentTranscript.trim()) {
            alert('请先录音说出你的回答');
            return;
        }

        setLoading(true);

        const analysisPrompt = `你是雅思考官。请严格按照以下格式评分学生回答：

话题：${selectedTopic?.question || '雅思口语练习'}
回答：${currentTranscript}

输出格式（Markdown）：

**评分：** 流利度 X/9 | 语法 X/9 | 词汇 X/9 | 发音 X/9

**优点：** 简洁列出
**改进：** 简洁列出
**高分范例：** 简短范例回答

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
        <div>
            {/* 标题区域 - 与通用口语完全一致 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ margin: 0 }}>🎙️ 雅思口语专项练习</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>模拟雅思口语考试，AI考官评分反馈</p>
                </div>
            </div>

            {/* 练习时长选择（保留雅思特色） */}
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
                <span style={{ fontWeight: 'bold', color: '#333' }}>⏱ 回答时长</span>
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
                    建议结构：直接回答 → 解释原因 → 举例 → 简短总结
                </span>
            </div>

            {/* 话题选择 - 下拉菜单 */}
            <div style={{ marginBottom: '24px' }}>
                <h3>📋 选择雅思话题</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <select
                        value={selectedTopic?.id || ''}
                        onChange={(e) => {
                            const topicId = parseInt(e.target.value);
                            const topic = topics.find(t => t.id === topicId);
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
                                {topic.category} - {topic.question.length > 40 ? topic.question.slice(0, 40) + '...' : topic.question}
                            </option>
                        ))}
                    </select>
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

            {/* 当前话题显示 */}
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

            {/* AI 参考答案 - 左对齐 */}
            {showAIReference && selectedTopic && (
                <div style={{ textAlign: 'left' }}>
                    <AIReference
                        currentQuestion={selectedTopic.question}
                        context="ielts"
                        onClose={() => setShowAIReference(false)}
                    />
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
                    disabled={!selectedTopic}
                />
                <AudioDebugger isRecording={isRecording} />
                {audioUrl && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>🎵 录音回放</div>
                        <audio controls src={audioUrl} style={{ width: '100%', maxWidth: '300px' }} />
                    </div>
                )}
            </div>

            {/* 识别结果区域 */}
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
                        {currentInterim || '按住空格键开始录音，松开后自动识别'}
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

            {/* AI 分析按钮 */}
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
                        🤖 AI 考官评分
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
                    🤖 雅思考官正在评分，请稍候...
                </div>
            )}

            {transcribing && (
                <div style={{ textAlign: 'center', padding: '16px', color: '#1890ff' }}>
                    🎧 正在识别录音，请稍候...
                </div>
            )}

            {/* AI 反馈展示 */}
            {aiResponse && (
                <div style={{
                    background: '#f5f5f5',
                    padding: '20px',
                    borderRadius: '8px',
                    marginTop: '20px'
                }}>
                    <h3>🤖 雅思考官反馈</h3>
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
                            🔊 朗读反馈
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
                <strong>💡 雅思口语使用说明：</strong>
                <ul style={{ margin: '8px 0 0 20px', lineHeight: '1.6' }}>
                    <li><strong>快速模式</strong>：浏览器实时识别，适合日常练习</li>
                    <li><strong>精准模式</strong>：Whisper 模型识别，适合正式模拟</li>
                    <li>每次录音会<strong>清空上一次的识别结果</strong>，AI 只分析最新一次回答</li>
                    <li>提交前可手动修正识别文本，确保评分准确</li>
                    <li>建议按 IELTS 回答时长准备：Part1 30-45秒，Part2 60-90秒</li>
                    <li>AI 考官会从流利度、语法、词汇、发音四个维度评分</li>
                </ul>
            </div>
        </div>
    );
}

export default IELTSSpeaking;