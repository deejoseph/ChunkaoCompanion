import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function FloatingAIAssistant({ currentTopic, currentSubject }) {
    const [isOpen, setIsOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);

    const askAI = async () => {
        if (!question.trim()) {
            alert('请输入你的问题');
            return;
        }

        setLoading(true);
        setAnswer('');

        try {
            const response = await axios.post('http://localhost:3001/api/ai/ask', {
                subject: currentSubject,
                question: currentTopic 
                    ? `关于《${currentTopic}》，学生问：${question}。请用通俗易懂的方式回答。`
                    : question
            });

            if (response.data.success) {
                setAnswer(response.data.answer);
            } else {
                setAnswer(`错误: ${response.data.error}`);
            }
        } catch (error) {
            setAnswer(`请求失败: ${error.message}\n\n请确保后端服务已启动`);
        }

        setLoading(false);
    };

    return (
        <>
            {/* 悬浮按钮 */}
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '30px',
                    background: '#1890ff',
                    color: 'white',
                    border: 'none',
                    fontSize: '28px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                🤖
            </button>

            {/* 对话框 */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: '100px',
                    right: '30px',
                    width: '400px',
                    maxWidth: 'calc(100vw - 60px)',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    zIndex: 1001,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    {/* 标题栏 */}
                    <div style={{
                        background: '#1890ff',
                        color: 'white',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontWeight: 'bold' }}>🤖 AI助教</span>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                fontSize: '20px',
                                cursor: 'pointer'
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {/* 当前知识点提示 */}
                    {currentTopic && (
                        <div style={{
                            background: '#f0f0f0',
                            padding: '8px 12px',
                            fontSize: '12px',
                            color: '#666'
                        }}>
                            当前学习：{currentTopic}
                        </div>
                    )}

                    {/* 输入区域 */}
                    <div style={{ padding: '16px' }}>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="输入你对这个知识点的疑问..."
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '10px',
                                fontSize: '14px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                resize: 'vertical',
                                boxSizing: 'border-box'
                            }}
                        />
                        <button
                            onClick={askAI}
                            disabled={loading}
                            style={{
                                marginTop: '12px',
                                width: '100%',
                                padding: '10px',
                                background: '#1890ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            {loading ? 'AI思考中...' : '向AI提问'}
                        </button>
                    </div>

                    {/* 回答区域 */}
                    {answer && (
                        <div style={{
                            borderTop: '1px solid #eee',
                            padding: '16px',
                            maxHeight: '400px',
                            overflow: 'auto',
                            background: '#fafafa'
                        }}>
                            <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                            >
                                {answer}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

export default FloatingAIAssistant;