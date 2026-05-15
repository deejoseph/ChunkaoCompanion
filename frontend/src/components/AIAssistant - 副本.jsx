import { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const API_BASE = 'http://localhost:3001';

function AIAssistant() {
    const [subject, setSubject] = useState('math');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [modelInfo, setModelInfo] = useState('');
    const [currentModel, setCurrentModel] = useState('');
    const [modelDisplayName, setModelDisplayName] = useState('');
    const [modelChanged, setModelChanged] = useState(false);
    const [showFormulaInput, setShowFormulaInput] = useState(false);
    const [formulaLatex, setFormulaLatex] = useState('');
    const [uploading, setUploading] = useState(false);
    const [recognizedFormulas, setRecognizedFormulas] = useState([]);
    const [showTextOcrModal, setShowTextOcrModal] = useState(false);
    const [textOcrContent, setTextOcrContent] = useState('');
    const [textOcrUploading, setTextOcrUploading] = useState(false);
    const [textOcrSavedFile, setTextOcrSavedFile] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    
    // 监听 localStorage 变化
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'ai_model') {
                console.log('模型已切换:', e.newValue);
                // 清空之前的回答和模型显示
                setAnswer('');
                setModelInfo('');
                setCurrentModel('');
                setModelChanged(true);
                // 可选：显示提示
                setTimeout(() => setModelChanged(false), 3000);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // 在 UI 中显示提示
    {modelChanged && (
        <div style={{
            background: '#fff7e6',
            border: '1px solid #ffc53d',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '15px',
            fontSize: '13px'
        }}>
            ⚙️ 模型已切换，下次提问将使用新模型
        </div>
    )}

    // 或者使用自定义事件（更可靠）
    const refreshModelDisplay = () => {
        const preference = localStorage.getItem('ai_model') || 'math_balanced';
        const modelNames = {
            math_fast: '快速模式 (qwen2-math:1.5b)',
            math_medium: '中速模式 (qwen2-math:7b)',
            math_balanced: '均衡模式 (qwen2.5-coder:7b)'
        };
        // 注意：这里只是显示用户选择的偏好，实际使用模型以后端返回为准
        const display = modelNames[preference] || preference;
        console.log('当前偏好模型:', display);
    };

    // 每次打开 AI 助教时刷新
    useEffect(() => {
        refreshModelDisplay();
    }, []);

    const subjects = [
        { value: 'chinese', label: '语文', color: '#52c41a' },
        { value: 'math', label: '数学', color: '#1890ff' },
        { value: 'english', label: '英语', color: '#fa8c16' },
        { value: 'essay', label: '作文批改', color: '#eb2f96' }
    ];

    const appendToQuestion = (text) => {
        const value = text.trim();
        if (!value) return;
        setQuestion(prev => prev ? `${prev}\n\n${value}` : value);
    };

    const handleFormulaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await axios.post(`${API_BASE}/api/ocr/recognize`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const latex = response.data.latex || '';
                setRecognizedFormulas(prev => [...prev, { id: Date.now(), latex }]);
                setFormulaLatex('');
                alert('公式已识别，可在下方预览后插入。');
            } else {
                alert(`识别失败：${response.data.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('公式 OCR 失败:', error);
            alert('公式识别失败，请重试。');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleTextImageFile = async (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件。');
            return;
        }

        setTextOcrUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await axios.post(`${API_BASE}/api/ocr/recognize-text`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                setTextOcrContent(response.data.text || '');
                setTextOcrSavedFile(response.data.savedFile || '');
            } else {
                alert(`图文识别失败：${response.data.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('图文 OCR 失败:', error);
            alert('图文识别失败，请确认后端服务和 PaddleOCR 环境正常。');
        } finally {
            setTextOcrUploading(false);
        }
    };

    const handlePasteImage = async (e) => {
        const items = Array.from(e.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith('image/'));
        if (!imageItem) return;

        e.preventDefault();
        const file = imageItem.getAsFile();
        await handleTextImageFile(file);
    };

    const insertFormulaToQuestion = (latex) => {
        appendToQuestion(`$${latex}$`);
    };

    const insertFormulaToTextOcr = (latex) => {
        const value = `$${latex}$`;
        setTextOcrContent(prev => prev ? `${prev}\n${value}` : value);
    };

    const removeRecognizedFormula = (id) => {
        setRecognizedFormulas(prev => prev.filter(f => f.id !== id));
    };

    const sendTextOcrToQuestion = () => {
        appendToQuestion(textOcrContent);
        setShowTextOcrModal(false);
    };

    const askAI = async () => {
        if (!question.trim()) {
            alert('请输入你的问题。');
            return;
        }

        setLoading(true);
        setAnswer('');
        setModelInfo('');
        setCurrentModel('');

        const userPreference = {
            math: localStorage.getItem('ai_model') || 'math_medium'
        };

        try {
            const response = await axios.post(`${API_BASE}/api/ai/ask`, {
                subject,
                question,
                userPreference
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
            setAnswer(`请求失败: ${error.message}\n\n请确认后端服务已启动 (node app.js)`);
        } finally {
            setLoading(false);
        }
    };

    const getModelTip = () => {
        const modelMap = {
            快速模式: '适合普通题型，速度最快',
            中速模式: '适合疑难题目，准确率高',
            均衡模式: '适合需要美观公式的场景'
        };

        for (const [key, tip] of Object.entries(modelMap)) {
            if (currentModel.includes(key)) return tip;
        }
        return '难题可切换模型对比答案（点击顶部设置）';
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            <h1>AI 助教</h1>

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

            {currentModel && (
                <div style={{
                    background: '#e6f7ff',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    border: '1px solid #91d5ff'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span>当前模型：<strong>{currentModel}</strong></span>
                        <span style={{ fontSize: '13px', color: '#666' }}>{getModelTip()}</span>
                    </div>
                </div>
            )}

            <div style={{
                marginBottom: '15px',
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <button
                    onClick={() => setShowFormulaInput(!showFormulaInput)}
                    disabled={uploading || textOcrUploading}
                    style={{
                        padding: '6px 14px',
                        background: showFormulaInput ? '#1890ff' : '#f0f0f0',
                        color: showFormulaInput ? 'white' : '#333',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: uploading || textOcrUploading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        opacity: uploading || textOcrUploading ? 0.6 : 1
                    }}
                >
                    手动输入 LaTeX 公式
                </button>

                <label style={{
                    padding: '6px 14px',
                    background: '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: uploading || textOcrUploading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    display: 'inline-block',
                    opacity: uploading || textOcrUploading ? 0.6 : 1
                }}>
                    拍照识别公式
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFormulaUpload}
                        disabled={uploading || textOcrUploading}
                    />
                </label>

                <button
                    onClick={() => setShowTextOcrModal(true)}
                    disabled={uploading || textOcrUploading}
                    style={{
                        padding: '6px 14px',
                        background: '#f6ffed',
                        border: '1px solid #95de64',
                        color: '#237804',
                        borderRadius: '4px',
                        cursor: uploading || textOcrUploading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        opacity: uploading || textOcrUploading ? 0.6 : 1
                    }}
                >
                    拍照识别图文
                </button>

                {(uploading || textOcrUploading) && (
                    <span style={{ fontSize: '12px', color: '#ff6600' }}>
                        识别中，请稍候...
                    </span>
                )}
            </div>

            {showFormulaInput && !uploading && (
                <div style={{
                    marginBottom: '15px',
                    padding: '15px',
                    background: '#fafafa',
                    borderRadius: '8px',
                    border: '1px solid #e8e8e8'
                }}>
                    <textarea
                        placeholder="输入 LaTeX 公式，如: \frac{1}{2} 或 \sqrt{x^2+y^2}"
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
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => {
                                if (formulaLatex.trim()) {
                                    appendToQuestion(`$${formulaLatex.trim()}$`);
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
                                if (formulaLatex.trim()) {
                                    setTextOcrContent(prev => prev ? `${prev}\n$${formulaLatex.trim()}$` : `$${formulaLatex.trim()}$`);
                                    setFormulaLatex('');
                                }
                            }}
                            style={{
                                padding: '5px 12px',
                                background: '#52c41a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            插入图文内容框
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
                        常用写法：分数 \frac{'{'}1{'}'}{'{'}2{'}'}，根号 \sqrt{'{'}2{'}'}，积分 \int_{'{'}a{'}'}^{'{'}b{'}'}。
                    </div>
                </div>
            )}

            {recognizedFormulas.length > 0 && !uploading && (
                <div style={{
                    marginBottom: '15px',
                    padding: '12px',
                    background: '#f6ffed',
                    borderRadius: '8px',
                    border: '1px solid #b7eb8f'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '13px' }}>
                        识别出的公式：
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
                            <div style={{ flex: 1, minWidth: '220px', overflow: 'auto' }}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                >
                                    {`$${formula.latex}$`}
                                </ReactMarkdown>
                                <code style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{formula.latex}</code>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => insertFormulaToQuestion(formula.latex)}
                                    style={{
                                        padding: '4px 8px',
                                        background: '#1890ff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    插入提问
                                </button>
                                <button
                                    onClick={() => insertFormulaToTextOcr(formula.latex)}
                                    style={{
                                        padding: '4px 8px',
                                        background: '#52c41a',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    插入图文框
                                </button>
                                <button
                                    onClick={() => removeRecognizedFormula(formula.id)}
                                    style={{
                                        padding: '4px 8px',
                                        background: '#f5222d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {textOcrContent && (
                <div style={{
                    marginBottom: '15px',
                    padding: '14px',
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: '8px',
                    textAlign: 'left'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                        <strong>识别出的图文内容</strong>
                        {textOcrSavedFile && <span style={{ fontSize: '12px', color: '#666' }}>已保存到 uploads/{textOcrSavedFile}</span>}
                    </div>
                    <textarea
                        value={textOcrContent}
                        onChange={(e) => setTextOcrContent(e.target.value)}
                        rows={6}
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            resize: 'vertical',
                            fontSize: '14px',
                            lineHeight: 1.6
                        }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <button
                            onClick={sendTextOcrToQuestion}
                            style={{
                                padding: '7px 14px',
                                background: '#1890ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            发送到 AI 助教输入框
                        </button>
                        <button
                            onClick={() => setShowTextOcrModal(true)}
                            style={{
                                padding: '7px 14px',
                                background: '#f0f0f0',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            继续识别图片
                        </button>
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '20px' }}>
                <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="输入你的问题... 支持 LaTeX 公式"
                    rows={5}
                    style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '16px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                    }}
                />
            </div>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={askAI}
                    disabled={loading || !question.trim() || uploading || textOcrUploading}
                    style={{
                        padding: '10px 24px',
                        fontSize: '16px',
                        background: (loading || !question.trim() || uploading || textOcrUploading) ? '#ccc' : '#1890ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (loading || !question.trim() || uploading || textOcrUploading) ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'AI 思考中...' : '提问'}
                </button>
            </div>

            {modelInfo && (
                <div style={{ marginBottom: '10px', color: '#666', fontSize: '12px' }}>
                    {modelInfo}
                </div>
            )}

            {answer && (
                <div style={{
                    background: '#f5f5f5',
                    padding: '20px',
                    borderRadius: '8px',
                    marginTop: '20px',
                    overflow: 'auto',
                    textAlign: 'left'
                }}>
                    <h3>AI 回答：</h3>
                    <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                    >
                        {answer}
                    </ReactMarkdown>
                </div>
            )}

            {showTextOcrModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.48)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1200,
                        padding: '20px'
                    }}
                    onPaste={handlePasteImage}
                >
                    <div style={{
                        width: '720px',
                        maxWidth: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        background: '#fff',
                        borderRadius: '8px',
                        padding: '22px',
                        boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
                        textAlign: 'left'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '14px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px' }}>拍照识别图文</h2>
                            <button
                                onClick={() => setShowTextOcrModal(false)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '22px',
                                    cursor: 'pointer',
                                    lineHeight: 1
                                }}
                                aria-label="关闭"
                            >
                                x
                            </button>
                        </div>

                        <div style={{
                            background: '#f6ffed',
                            border: '1px solid #b7eb8f',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            marginBottom: '16px',
                            color: '#333',
                            lineHeight: 1.65
                        }}>
                            <strong>建议流程：</strong>
                            <ol style={{ margin: '8px 0 0 20px', padding: 0 }}>
                                <li>先截图或拍照。可以在这个弹窗里直接粘贴剪贴板图片，也可以把其他目录里的图片拖进来；系统会保存到 <code>backend/uploads</code>，避免放错位置。</li>
                                <li>点击或拖入图片后，使用“拍照识别图文”提取图文混排内容，识别结果会进入“识别出的图文内容”框。</li>
                                <li>如果题目里有公式，PaddleOCR 可能识别不准。会写 LaTeX 时用“手动输入 LaTeX 公式”；不会写时用“拍照识别公式”，把公式逐一截图识别，再手工插入图文内容框。</li>
                                <li>确认内容完整后，点击“发送到 AI 助教输入框”，再向 AI 提问。</li>
                            </ol>
                        </div>

                        <label
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                const file = e.dataTransfer.files?.[0];
                                handleTextImageFile(file);
                            }}
                            style={{
                                display: 'block',
                                border: `2px dashed ${isDragging ? '#1890ff' : '#91d5ff'}`,
                                background: isDragging ? '#e6f7ff' : '#fafafa',
                                borderRadius: '8px',
                                padding: '28px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                marginBottom: '14px'
                            }}
                        >
                            <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                disabled={textOcrUploading}
                                onChange={(e) => {
                                    handleTextImageFile(e.target.files?.[0]);
                                    e.target.value = '';
                                }}
                            />
                            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                                {textOcrUploading ? '正在识别，请稍候...' : '点击选择图片、拖入图片，或直接 Ctrl+V 粘贴截图'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                                支持 PNG、JPG 等图片。图文识别使用 PaddleOCR，公式建议单独用 pix2tex 识别。
                            </div>
                        </label>

                        {textOcrSavedFile && (
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                                最近识别图片已保存到 <code>backend/uploads/{textOcrSavedFile}</code>
                            </div>
                        )}

                        <textarea
                            value={textOcrContent}
                            onChange={(e) => setTextOcrContent(e.target.value)}
                            placeholder="识别出的图文内容会显示在这里。你可以在这里手工修正文字，并插入 LaTeX 公式。"
                            rows={9}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '10px',
                                borderRadius: '4px',
                                border: '1px solid #ccc',
                                resize: 'vertical',
                                fontSize: '14px',
                                lineHeight: 1.6,
                                marginBottom: '12px'
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setShowTextOcrModal(false)}
                                style={{
                                    padding: '8px 16px',
                                    background: '#f0f0f0',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                稍后处理
                            </button>
                            <button
                                onClick={sendTextOcrToQuestion}
                                disabled={!textOcrContent.trim()}
                                style={{
                                    padding: '8px 16px',
                                    background: textOcrContent.trim() ? '#1890ff' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: textOcrContent.trim() ? 'pointer' : 'not-allowed'
                                }}
                            >
                                发送到 AI 助教输入框
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AIAssistant;
