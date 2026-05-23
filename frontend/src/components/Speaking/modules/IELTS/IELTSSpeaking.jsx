import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceRecorder from '../../VoiceRecorder';
import Part1Panel from './ielts/Part1Panel';
import Part2Panel from './ielts/Part2Panel';
import Part3Panel from './ielts/Part3Panel';
import { getRandomPart1Question, getRandomPart2Topic, getPart3Questions } from './ielts/topics';

const API_BASE = 'http://localhost:3001';

function IELTSSpeaking() {
    const [currentPart, setCurrentPart] = useState(1);
    const [part1Question, setPart1Question] = useState(null);
    const [part2Topic, setPart2Topic] = useState(null);
    const [part3Data, setPart3Data] = useState(null);
    const [part3Index, setPart3Index] = useState(0);
    const [transcript, setTranscript] = useState('');
    const [aiFeedback, setAiFeedback] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [history, setHistory] = useState([]);
    
    const audioUrlRef = useRef(null);
    const finalTranscriptRef = useRef('');

    useEffect(() => {
        if (currentPart === 1 && !part1Question) {
            setPart1Question(getRandomPart1Question());
        }
        if (currentPart === 2 && !part2Topic) {
            setPart2Topic(getRandomPart2Topic());
        }
    }, [currentPart]);

    const handleTranscript = (text, isFinal) => {
        if (isFinal && text) {
            setTranscript(prev => prev + (prev ? ' ' : '') + text);
            finalTranscriptRef.current = transcript + (transcript ? ' ' : '') + text;
        }
    };

    const handleAudioBlob = (blob, audioUrl) => {
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        setAudioUrl(audioUrl);
        audioUrlRef.current = audioUrl;
    };

    const handleRecordingStart = () => setIsRecording(true);
    const handleRecordingStop = () => setIsRecording(false);

    const clearConversation = () => {
        setTranscript('');
        setAiFeedback('');
        finalTranscriptRef.current = '';
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        setAudioUrl(null);
    };

    const analyzeWithAI = async () => {
        if (!transcript.trim()) {
            alert('请先录音说出你的回答');
            return;
        }

        setLoading(true);
        
        let analysisPrompt = '';
        if (currentPart === 1 && part1Question) {
            analysisPrompt = `你是雅思考官。请对以下 Part 1 回答进行评分：

话题：${part1Question.topic}
问题：${part1Question.question}
回答：${transcript}

请按以下格式输出：

**分数评估：**
- 流利度与连贯性：X/9
- 词汇多样性：X/9
- 语法多样性与准确性：X/9
- 发音：X/9

**总分：X/9**

**优点：**（2-3点）
**改进建议：**（2-3点）
**示范回答：**（简短示范）`;
        } else if (currentPart === 2 && part2Topic) {
            analysisPrompt = `你是雅思考官。请对以下 Part 2 个人陈述进行评分：

话题：${part2Topic.title}
要求：${part2Topic.prompts.join('、')}
回答：${transcript}

请按以下格式输出：

**分数评估：**
- 流利度与连贯性：X/9
- 词汇多样性：X/9
- 语法多样性与准确性：X/9
- 发音：X/9

**总分：X/9**

**优点：**（2-3点）
**改进建议：**（2-3点）
**结构评价：**（是否有清晰的开头、主体和结尾）
**示范回答要点：**`;
        } else if (currentPart === 3 && part3Data) {
            analysisPrompt = `你是雅思考官。请对以下 Part 3 抽象话题讨论进行评分：

话题类别：${part3Data.category}
问题：${part3Data.questions[part3Index]}
回答：${transcript}

请按以下格式输出：

**分数评估：**
- 流利度与连贯性：X/9
- 词汇多样性：X/9
- 语法多样性与准确性：X/9
- 发音：X/9

**总分：X/9**

**优点：**（2-3点）
**改进建议：**（2-3点）
**逻辑评价：**（是否有清晰的论点和支持细节）
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
                setAiFeedback(response.data.answer);
                setHistory(prev => [{
                    part: currentPart,
                    question: currentPart === 1 ? part1Question?.question : (currentPart === 2 ? part2Topic?.title : part3Data?.questions[part3Index]),
                    transcript: transcript,
                    feedback: response.data.answer,
                    timestamp: new Date()
                }, ...prev].slice(0, 20));
            } else {
                setAiFeedback(`分析失败: ${response.data.error}`);
            }
        } catch (error) {
            console.error('AI 分析失败:', error);
            setAiFeedback(`请求失败: ${error.message}`);
        }
        setLoading(false);
    };

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

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
            <h1>🎙️ 雅思口语专项练习</h1>
            
            {/* Part 切换 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid #e8e8e8', paddingBottom: '12px' }}>
                <button onClick={() => switchPart(1)} style={{
                    padding: '10px 24px',
                    background: currentPart === 1 ? '#1890ff' : '#f0f0f0',
                    color: currentPart === 1 ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}>📝 Part 1 (4-5分钟)</button>
                <button onClick={() => switchPart(2)} style={{
                    padding: '10px 24px',
                    background: currentPart === 2 ? '#52c41a' : '#f0f0f0',
                    color: currentPart === 2 ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}>🎤 Part 2 (3-4分钟)</button>
                <button onClick={() => switchPart(3)} style={{
                    padding: '10px 24px',
                    background: currentPart === 3 ? '#fa8c16' : '#f0f0f0',
                    color: currentPart === 3 ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}>💬 Part 3 (4-5分钟)</button>
            </div>

            {/* 题目面板 */}
            {currentPart === 1 && (
                <Part1Panel question={part1Question} onNextQuestion={loadNewPart1} />
            )}
            {currentPart === 2 && (
                <Part2Panel 
                    topic={part2Topic} 
                    onPreparationStart={() => console.log('准备开始')}
                    onSpeakingStart={() => console.log('发言开始')}
                    onStopSpeaking={() => console.log('发言结束')}
                />
            )}
            {currentPart === 3 && part3Data && (
                <Part3Panel 
                    questions={part3Data.questions}
                    currentIndex={part3Index}
                    onNext={nextPart3}
                    onPrev={prevPart3}
                />
            )}

            {/* 录音区域 */}
            <div style={{
                background: '#fafafa',
                padding: '30px 20px',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '24px',
                border: isRecording ? '2px solid #ff4d4f' : '1px solid #e8e8e8'
            }}>
                <VoiceRecorder
                    onTranscript={handleTranscript}
                    onRecordingStart={handleRecordingStart}
                    onRecordingStop={handleRecordingStop}
                    onAudioBlob={handleAudioBlob}
                    disabled={false}
                />
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
                border: '1px solid #b7eb8f'
            }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>📝 你的回答</div>
                <textarea
                    value={transcript}
                    onChange={(e) => {
                        setTranscript(e.target.value);
                        finalTranscriptRef.current = e.target.value;
                    }}
                    rows={6}
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #d9d9d9',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                    }}
                    placeholder="录音后识别结果会显示在这里，你也可以直接编辑..."
                />
            </div>

            {/* AI 评分按钮 */}
            {transcript && !loading && (
                <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                    <button onClick={analyzeWithAI} style={{
                        padding: '10px 24px',
                        background: '#52c41a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '30px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}>🤖 AI 评分与分析</button>
                    <button onClick={clearConversation} style={{
                        marginLeft: '12px',
                        padding: '10px 24px',
                        background: '#f0f0f0',
                        color: '#333',
                        border: 'none',
                        borderRadius: '30px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}>🗑️ 清空</button>
                </div>
            )}

            {loading && <div style={{ textAlign: 'center', padding: '20px', color: '#1890ff' }}>🤖 AI 评分中，请稍候...</div>}

            {/* AI 反馈 */}
            {aiFeedback && (
                <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
                    <h3>📊 AI 评分与反馈</h3>
                    <div className="markdown-body" style={{ fontSize: '14px', lineHeight: '1.6', wordBreak: 'break-word' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiFeedback}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* 历史记录 */}
            {history.length > 0 && (
                <details style={{ marginTop: '30px' }}>
                    <summary style={{ cursor: 'pointer', color: '#1890ff' }}>📋 练习历史 ({history.length})</summary>
                    <div style={{ marginTop: '12px' }}>
                        {history.map((item, idx) => (
                            <div key={idx} style={{ padding: '12px', marginBottom: '8px', background: '#fafafa', borderRadius: '8px', fontSize: '13px' }}>
                                <div><strong>Part {item.part}</strong> - {item.question?.substring(0, 50)}...</div>
                                <div style={{ fontSize: '11px', color: '#999' }}>{new Date(item.timestamp).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {/* 使用说明 */}
            <div style={{ marginTop: '24px', padding: '16px', background: '#fff7e6', borderRadius: '8px', border: '1px solid #ffc53d' }}>
                <strong>💡 雅思口语考试说明：</strong>
                <ul style={{ margin: '8px 0 0 20px', lineHeight: '1.6' }}>
                    <li><strong>Part 1 (4-5分钟)</strong>：日常话题问答，用2-3句话回答</li>
                    <li><strong>Part 2 (3-4分钟)</strong>：1分钟准备 + 2分钟陈述，要涵盖所有要点</li>
                    <li><strong>Part 3 (4-5分钟)</strong>：抽象话题讨论，表达观点并举例支持</li>
                    <li>按住空格键开始录音，松开自动结束识别</li>
                    <li>识别后可以手动修正文本，再提交AI评分</li>
                </ul>
            </div>
        </div>
    );
}

export default IELTSSpeaking;