import { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function AIAssistant() {
    const [subject, setSubject] = useState('math');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [modelInfo, setModelInfo] = useState('');
    const [currentModel, setCurrentModel] = useState('');
    const [showFormulaInput, setShowFormulaInput] = useState(false);
    const [formulaLatex, setFormulaLatex] = useState('');
    const [uploading, setUploading] = useState(false);
    const [recognizedFormulas, setRecognizedFormulas] = useState([]);  // 存储识别出的公式

    const subjects = [
        { value: 'chinese', label: '语文', color: '#52c41a' },
        { value: 'math', label: '数学', color: '#1890ff' },
        { value: 'english', label: '英语', color: '#fa8c16' },
        { value: 'essay', label: '作文批改', color: '#eb2f96' }
    ];

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
                // 添加到识别列表
                setRecognizedFormulas(prev => [...prev, { id: Date.now(), latex, rendered: true }]);
                setFormulaLatex('');
                alert('公式已识别，可在下方预览后插入');
            } else {
                alert('识别失败：' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('OCR识别失败:', error);
            alert('识别失败，请重试');
        }
        setUploading(false);
        // 不清空文件输入框（可选）
        e.target.value = '';
    };

    // 将识别的公式插入输入框
    const insertFormulaToQuestion = (latex) => {
        setQuestion(prev => prev + (prev ? ' ' : '') + latex);
    };

    // 删除识别的公式
    const removeRecognizedFormula = (id) => {
        setRecognizedFormulas(prev => prev.filter(f => f.id !== id));
    };

    const askAI = async () => {
        if (!question.trim()) {
            alert('请输入你的问题');
            return;
        }

        setLoading(true);
        setAnswer('');
        setModelInfo('');
        setCurrentModel('');

        // 获取用户保存的模型偏好
        const userPreference = {
            math: localStorage.getItem('ai_model') || 'math_medium'
        };

        try {
            const response = await axios.post('http://localhost:3001/api/ai/ask', {
                subject: subject,
                question: question,
                userPreference: userPreference
            });

            if (response.data.success) {
                setAnswer(response.data.answer);
                const displayName = response.data.modelDisplayName || response.data.model;
                setCurrentModel(displayName);
                setModelInfo(`使用模型: ${displayName}`);
            } else {
                setAnswer(`错误: ${response.data.error}`);
            }
        } catch (error) {
            setAnswer(`请求失败: ${error.message}\n\n请确保后端服务已启动 (node app.js)`);
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
        return '💡 难题可切换模型对比答案（点击顶部⚙️设置）';
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            <h1>🤖 AI助教</h1>
            
            {/* 学科选择 */}
            <div style={{ marginBottom: '20px' }}>
                <label style={{ marginRight: '10px' }}>选择学科：</label>
                {subjects.map(s => (
                    <button
                        key={s.value}
                        onClick={() => setSubject(s.value)}
                        style={{
                            margin: '0 5px',
                            padding: '8px 16px',
                            background: subject === s.value ? s.color : '#f0f0f0',
                            color: subject === s.value ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* 当前模型显示 */}
            {currentModel && (
                <div style={{
                    background: '#e6f7ff',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    border: '1px solid #91d5ff'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span>🧠 当前模型：<strong>{currentModel}</strong></span>
                        <span style={{ fontSize: '13px', color: '#666' }}>{getModelTip()}</span>
                    </div>
                </div>
            )}

            {/* 公式工具栏 */}
            <div style={{
                marginBottom: '15px',
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <button
                    onClick={() => setShowFormulaInput(!showFormulaInput)}
                    disabled={uploading}
                    style={{
                        padding: '6px 14px',
                        background: showFormulaInput ? '#1890ff' : '#f0f0f0',
                        color: showFormulaInput ? 'white' : '#333',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        opacity: uploading ? 0.6 : 1
                    }}
                >
                    📐 手动输入公式
                </button>
                <label style={{
                    padding: '6px 14px',
                    background: '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    display: 'inline-block',
                    opacity: uploading ? 0.6 : 1
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
                {uploading && <span style={{ fontSize: '12px', color: '#ff6600' }}>⏳ 识别中，请稍候...</span>}
            </div>

            {/* 公式输入面板 */}
            {showFormulaInput && !uploading && (
                <div style={{
                    marginBottom: '15px',
                    padding: '15px',
                    background: '#fafafa',
                    borderRadius: '8px',
                    border: '1px solid #e8e8e8'
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
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button
                            onClick={() => {
                                if (formulaLatex) {
                                    setQuestion(prev => prev + (prev ? ' ' : '') + formulaLatex);
                                    setFormulaLatex('');
                                    setShowFormulaInput(false);
                                }
                            }}
                            style={{
                                padding: '5px 12px',
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
                                padding: '5px 12px',
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

            {/* 识别出的公式预览区域 */}
            {recognizedFormulas.length > 0 && !uploading && (
                <div style={{
                    marginBottom: '15px',
                    padding: '12px',
                    background: '#f6ffed',
                    borderRadius: '8px',
                    border: '1px solid #b7eb8f'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '13px' }}>
                        📋 识别出的公式（点击可插入输入框）：
                    </div>
                    {recognizedFormulas.map(formula => (
                        <div
                            key={formula.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px',
                                marginBottom: '8px',
                                background: 'white',
                                borderRadius: '4px',
                                border: '1px solid #e8e8e8',
                                flexWrap: 'wrap',
                                gap: '8px'
                            }}
                        >
                            <div
                                style={{
                                    flex: 1,
                                    fontFamily: 'monospace',
                                    fontSize: '13px',
                                    overflow: 'auto',
                                    cursor: 'pointer'
                                }}
                                onClick={() => insertFormulaToQuestion(formula.latex)}
                                title="点击插入到输入框"
                            >
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                >
                                    {`$${formula.latex}$`}
                                </ReactMarkdown>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    onClick={() => insertFormulaToQuestion(formula.latex)}
                                    style={{
                                        padding: '2px 8px',
                                        background: '#1890ff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '11px'
                                    }}
                                >
                                    插入
                                </button>
                                <button
                                    onClick={() => removeRecognizedFormula(formula.id)}
                                    style={{
                                        padding: '2px 8px',
                                        background: '#f5222d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '11px'
                                    }}
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 问题输入 */}
            <div style={{ marginBottom: '20px' }}>
                <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="输入你的问题...（支持LaTeX公式）"
                    rows={4}
                    style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '16px',
                        borderRadius: '4px',
                        border: '1px solid #ccc'
                    }}
                />
            </div>

            {/* 提问按钮 */}
            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={askAI}
                    disabled={loading || !question || uploading}
                    style={{
                        padding: '10px 24px',
                        fontSize: '16px',
                        background: (loading || !question || uploading) ? '#ccc' : '#1890ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (loading || !question || uploading) ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'AI思考中...' : uploading ? '识别中，请稍候...' : '提问'}
                </button>
            </div>

            {/* 模型信息 */}
            {modelInfo && (
                <div style={{ marginBottom: '10px', color: '#666', fontSize: '12px' }}>
                    {modelInfo}
                </div>
            )}

            {/* AI回答 */}
            {answer && (
                <div style={{
                    background: '#f5f5f5',
                    padding: '20px',
                    borderRadius: '8px',
                    marginTop: '20px',
                    overflow: 'auto',
                    textAlign: 'left'
                }}>
                    <h3>AI回答：</h3>
                    <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                    >
                        {answer}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
}

export default AIAssistant;