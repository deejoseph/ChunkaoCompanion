import { useState, useEffect } from 'react';
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
    const [currentModel, setCurrentModel] = useState('');
    const [showFormulaInput, setShowFormulaInput] = useState(false);
    const [formulaLatex, setFormulaLatex] = useState('');
    const [uploading, setUploading] = useState(false);

    // 监听来自 TopicLearning 的公式
    useEffect(() => {
        const handleSendToAI = (event) => {
            setIsOpen(true);
            setQuestion(event.detail.text);
        };
        
        window.addEventListener('sendToAI', handleSendToAI);
        return () => window.removeEventListener('sendToAI', handleSendToAI);
    }, []);

    // 处理OCR上传识别公式
    const handleFormulaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await axios.post('http://localhost:3001/api/ocr/recognize', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                const latex = response.data.latex;
                setFormulaLatex(latex);
                setQuestion(prev => prev + (prev ? ' ' : '') + latex);
                alert('公式已识别并添加到输入框');
            } else {
                alert('识别失败：' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('OCR识别失败:', error);
            alert('识别失败，请重试');
        }
        setUploading(false);
        setShowFormulaInput(false);
    };

    const askAI = async () => {
        if (!question.trim()) {
            alert('请输入你的问题');
            return;
        }

        setLoading(true);
        setAnswer('');
        setCurrentModel('');

        // 获取用户保存的模型偏好
        const userPreference = {
            math: localStorage.getItem('ai_model') || 'math_medium'
        };

        try {
            const response = await axios.post('http://localhost:3001/api/ai/ask', {
                subject: currentSubject,
                question: currentTopic 
                    ? `关于《${currentTopic}》，学生问：${question}。请用通俗易懂的方式回答。`
                    : question,
                userPreference: userPreference
            });

            if (response.data.success) {
                setAnswer(response.data.answer);
                setCurrentModel(response.data.modelDisplayName || response.data.model);
            } else {
                setAnswer(`错误: ${response.data.error}`);
            }
        } catch (error) {
            setAnswer(`请求失败: ${error.message}\n\n请确保后端服务已启动`);
        }

        setLoading(false);
    };

    // 获取当前模型的提示信息
    const getModelTip = () => {
        const modelMap = {
            '快速模式': '⚡ 适合普通题型，速度最快',
            '中速模式': '🚀 适合疑难题目，准确率高',
            '均衡模式': '🎨 适合需要美观公式的场景'
        };
        for (const [key, tip] of Object.entries(modelMap)) {
            if (currentModel.includes(key)) return tip;
        }
        return '💡 难题可切换不同模型对比答案';
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
                    width: '500px',
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
                            color: '#666',
                            borderBottom: '1px solid #e8e8e8'
                        }}>
                            📖 当前学习：{currentTopic}
                        </div>
                    )}

                    {/* 当前模型显示 */}
                    {currentModel && (
                        <div style={{
                            background: '#e6f7ff',
                            padding: '8px 12px',
                            fontSize: '12px',
                            color: '#1890ff',
                            borderBottom: '1px solid #91d5ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '6px'
                        }}>
                            <span>🧠 当前模型：{currentModel}</span>
                            <span style={{ fontSize: '11px', color: '#666' }}>{getModelTip()}</span>
                        </div>
                    )}

                    {/* 公式工具栏 */}
                    <div style={{
                        background: '#f5f5f5',
                        padding: '8px 12px',
                        borderBottom: '1px solid #e8e8e8',
                        display: 'flex',
                        gap: '10px',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={() => setShowFormulaInput(!showFormulaInput)}
                            style={{
                                padding: '4px 12px',
                                background: showFormulaInput ? '#1890ff' : '#fff',
                                color: showFormulaInput ? 'white' : '#333',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            📐 手动输入公式
                        </button>
                        <label style={{
                            padding: '4px 12px',
                            background: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'inline-block'
                        }}>
                            📸 拍照识别公式
                            <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleFormulaUpload}
                                disabled={uploading}
                            />
                        </label>
                        {uploading && <span style={{ fontSize: '12px', color: '#999' }}>识别中...</span>}
                    </div>

                    {/* 公式输入面板 */}
                    {showFormulaInput && (
                        <div style={{
                            padding: '12px',
                            background: '#fafafa',
                            borderBottom: '1px solid #e8e8e8'
                        }}>
                            <textarea
                                placeholder="输入LaTeX公式，如: \frac{1}{2} 或 \sqrt{x^2+y^2}"
                                rows={2}
                                value={formulaLatex}
                                onChange={(e) => setFormulaLatex(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '13px',
                                    fontFamily: 'monospace',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    boxSizing: 'border-box',
                                    resize: 'vertical'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button
                                    onClick={() => {
                                        if (formulaLatex) {
                                            setQuestion(prev => prev + (prev ? ' ' : '') + formulaLatex);
                                            setFormulaLatex('');
                                            setShowFormulaInput(false);
                                        }
                                    }}
                                    style={{
                                        padding: '4px 12px',
                                        background: '#1890ff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    添加到提问
                                </button>
                                <button
                                    onClick={() => {
                                        setShowFormulaInput(false);
                                        setFormulaLatex('');
                                    }}
                                    style={{
                                        padding: '4px 12px',
                                        background: '#f0f0f0',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    取消
                                </button>
                            </div>
                            <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                                💡 常用公式：分数 \frac{1}{2}，根号 \sqrt{2}，积分 \int_{a}^{b}
                            </div>
                        </div>
                    )}

                    {/* 输入区域 */}
                    <div style={{ padding: '16px' }}>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="输入你的问题...（支持LaTeX公式）"
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
                            background: '#fafafa',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            textAlign: 'left'
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