import { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const API_BASE = 'http://localhost:3001';

// 模型显示标签映射（根据学科和模型值返回显示文本）
const getModelDisplayLabel = (subject, modelValue) => {
  // 数学学科
  if (subject === 'math') {
    if (modelValue === 'qwen2-math:1.5b') return '🧮 数学·轻量模式：qwen2-math:1.5b（3-8秒，极速响应）';
    if (modelValue === 'qwen2.5:7b') return '🧮 数学·快速模式：qwen2.5:7b（5-15秒，适合基础题）';
    if (modelValue === 'qwen2-math:7b') return '🧮 数学·标准模式：qwen2-math:7b（15-30秒，数学专项）';
    if (modelValue === 'qwen2.5:14b') return '🧮 数学·专业模式：qwen2.5:14b（20-40秒，适合难题）';
    if (modelValue === 'qwen2.5-coder:7b') return '🧮 数学·参考模式：qwen2.5-coder:7b（30-60秒，公式美观）';
    return `🧮 数学·${modelValue}`;
  }
  
  // 语文学科
  if (subject === 'chinese') {
    if (modelValue === 'qwen2.5:7b') return '📖 语文·快速模式：qwen2.5:7b（5-15秒，基础阅读）';
    if (modelValue === 'qwen2.5:14b') return '📖 语文·专业模式：qwen2.5:14b（20-40秒，作文/阅读）';
    if (modelValue === 'qwen2.5-coder:7b') return '📖 语文·参考模式：qwen2.5-coder:7b（30-60秒，规范输出）';
    return `📖 语文·${modelValue}`;
  }
  
  // 英语学科
  if (subject === 'english') {
    if (modelValue === 'gemma3:4b') return '🇬🇧 英语·快速模式：gemma3:4b（5-15秒，英语专用）';
    if (modelValue === 'qwen2.5:7b') return '🇬🇧 英语·标准模式：qwen2.5:7b（5-15秒，通用能力）';
    if (modelValue === 'qwen2.5:14b') return '🇬🇧 英语·专业模式：qwen2.5:14b（20-40秒，阅读/写作）';
    if (modelValue === 'qwen2.5-coder:7b') return '🇬🇧 英语·参考模式：qwen2.5-coder:7b（30-60秒，翻译优化）';
    return `🇬🇧 英语·${modelValue}`;
  }
  
  return modelValue;
};

function AIAssistant() {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [modelInfo, setModelInfo] = useState('');
    const [showFormulaInput, setShowFormulaInput] = useState(false);
    const [formulaLatex, setFormulaLatex] = useState('');
    const [uploading, setUploading] = useState(false);
    const [recognizedFormulas, setRecognizedFormulas] = useState([]);
    const [showTextOcrModal, setShowTextOcrModal] = useState(false);
    const [textOcrContent, setTextOcrContent] = useState('');
    const [textOcrUploading, setTextOcrUploading] = useState(false);
    const [textOcrSavedFile, setTextOcrSavedFile] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    
    // 当前学科
    const [currentSubject, setCurrentSubject] = useState('math');
    
    // 学科模型配置（每个学科独立的模型）
    const [subjectModels, setSubjectModels] = useState(() => {
        const saved = localStorage.getItem('subject_models');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('解析学科模型配置失败', e);
            }
        }
        // 默认配置
        return {
            math: 'qwen2-math:7b',
            chinese: 'qwen2.5:14b',
            english: 'gemma3:4b'
        };
    });
    
    // 获取当前学科对应的模型
    const currentModel = subjectModels[currentSubject] || 'qwen2.5:14b';
    
    // 获取当前学科模型的显示标签
    const currentModelLabel = getModelDisplayLabel(currentSubject, currentModel);
    
    // 初始化时从 localStorage 加载配置
    useEffect(() => {
        const saved = localStorage.getItem('subject_models');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setSubjectModels(parsed);
            } catch (e) {
                console.error('解析失败', e);
            }
        }
    }, []);
    
    // 监听学科模型配置变更
    useEffect(() => {
        const handleModelsChange = (event) => {
            const newModels = event.detail;
            if (newModels) {
                setSubjectModels(newModels);
                setModelInfo(`模型配置已更新`);
                setTimeout(() => setModelInfo(''), 2000);
            }
        };
        
        window.addEventListener('modelsChanged', handleModelsChange);
        return () => window.removeEventListener('modelsChanged', handleModelsChange);
    }, []);
    
    // 监听 localStorage 变化（跨标签页同步）
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'subject_models' && e.newValue) {
                try {
                    const newModels = JSON.parse(e.newValue);
                    setSubjectModels(newModels);
                    setModelInfo(`模型配置已更新`);
                    setTimeout(() => setModelInfo(''), 2000);
                } catch (e) {
                    console.error('解析失败', e);
                }
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
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
                setShowTextOcrModal(true);
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

    const getSubjectPrompt = () => {
        const prompts = {
            math: '你是一位上海春考数学阅卷老师，请用清晰、准确的数学语言解答问题，涉及公式时使用 LaTeX 格式。',
            chinese: '你是一位上海春考语文阅卷老师，请严格依据原文和语境作答，默写题务必逐字准确，阅读理解要分析到位。',
            english: '你是一位上海春考英语阅卷老师，请注意语法准确性和搭配恰当性，阅读理解要抓住关键信息。',
            essay: '你是一位上海春考作文阅卷老师，请从立意、结构、语言、素材等角度进行批改，给出具体修改建议。'
        };
        return prompts[currentSubject] || prompts.math;
    };

    const askAI = async () => {
        if (!question.trim()) {
            alert('请输入你的问题。');
            return;
        }

        setLoading(true);
        setAnswer('');
        setModelInfo('');

        const subjectPrompt = getSubjectPrompt();
        const fullQuestion = `${subjectPrompt}\n\n学生问题：${question}`;

        try {
            const response = await axios.post(`${API_BASE}/api/ai/ask`, {
                subject: currentSubject,
                question: fullQuestion,
                model: currentModel  // 使用当前学科对应的模型
            });

            if (response.data.success) {
                setAnswer(response.data.answer);
                setModelInfo(`使用模型: ${currentModelLabel}`);
            } else {
                setAnswer(`错误: ${response.data.error}`);
            }
        } catch (error) {
            setAnswer(`请求失败: ${error.message}\n\n请确认后端服务已启动 (node app.js)`);
        } finally {
            setLoading(false);
        }
    };

    const getSubjectIcon = () => {
        switch(currentSubject) {
            case 'chinese': return '📖';
            case 'math': return '🧮';
            case 'english': return '🇬🇧';
            case 'essay': return '✍️';
            default: return '🤖';
        }
    };

    const getSubjectColor = () => {
        switch(currentSubject) {
            case 'chinese': return '#52c41a';
            case 'math': return '#1890ff';
            case 'english': return '#fa8c16';
            case 'essay': return '#eb2f96';
            default: return '#1890ff';
        }
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            <h1>{getSubjectIcon()} AI 助教 - {subjects.find(s => s.value === currentSubject)?.label || '数学'}</h1>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ marginRight: '10px' }}>选择学科：</label>
                {subjects.map(s => (
                    <button
                        key={s.value}
                        onClick={() => setCurrentSubject(s.value)}
                        style={{
                            margin: '0 5px',
                            padding: '8px 16px',
                            background: currentSubject === s.value ? s.color : '#f0f0f0',
                            color: currentSubject === s.value ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* 显示当前模型 - 根据学科显示对应的模型 */}
            <div style={{
                background: '#e6f7ff',
                padding: '10px 15px',
                borderRadius: '8px',
                marginBottom: '15px',
                border: '1px solid #91d5ff'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span>
                        <span style={{ fontSize: '16px', marginRight: '8px' }}>{getSubjectIcon()}</span>
                        <strong>{subjects.find(s => s.value === currentSubject)?.label}</strong> 当前模型：<strong style={{ color: getSubjectColor() }}>{currentModelLabel}</strong>
                    </span>
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
                    💡 提示：可在顶部 ⚙️ 系统设置中为每个学科单独配置模型
                </div>
            </div>

            {modelInfo && (
                <div style={{
                    background: '#f6ffed',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '12px',
                    color: '#52c41a',
                    border: '1px solid #b7eb8f'
                }}>
                    {modelInfo}
                </div>
            )}

            {/* 其余 UI 代码保持不变... */}
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

            {textOcrContent && !showTextOcrModal && (
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
                        background: (loading || !question.trim() || uploading || textOcrUploading) ? '#ccc' : getSubjectColor(),
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (loading || !question.trim() || uploading || textOcrUploading) ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'AI 思考中...' : `向 ${subjects.find(s => s.value === currentSubject)?.label} AI 提问`}
                </button>
            </div>

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
                                ×
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