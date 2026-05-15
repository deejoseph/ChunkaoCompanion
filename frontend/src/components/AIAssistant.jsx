import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';  // 导入KaTeX样式

const subjects = [
    { value: 'chinese', label: '语文', model: 'qwen2.5:7b' },
    { value: 'math', label: '数学', model: 'qwen2.5-coder:7b' },
    { value: 'english', label: '英语', model: 'qwen2.5:7b' },
    { value: 'essay', label: '作文批改', model: 'qwen2.5:7b' }
];

function AIAssistant() {
    const [subject, setSubject] = useState('math');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [modelInfo, setModelInfo] = useState('');

    const askAI = async () => {
        if (!question.trim()) return;

        setLoading(true);
        setAnswer('');
        setModelInfo('');

        try {
            const response = await axios.post('http://localhost:3001/api/ai/ask', {
                subject: subject,
                question: question
            });

            if (response.data.success) {
                setAnswer(response.data.answer);
                setModelInfo(`使用模型: ${response.data.model}`);
            } else {
                setAnswer(`错误: ${response.data.error}`);
            }
        } catch (error) {
            setAnswer(`请求失败: ${error.message}\n\n请确保后端服务已启动 (node app.js)`);
        }

        setLoading(false);
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            <h1>🤖 春考AI助教</h1>
            
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
                            background: subject === s.value ? '#1890ff' : '#f0f0f0',
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

            {/* 问题输入 */}
            <div style={{ marginBottom: '20px' }}>
                <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="输入你的问题..."
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
                    disabled={loading || !question}
                    style={{
                        padding: '10px 24px',
                        fontSize: '16px',
                        background: '#1890ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {loading ? 'AI思考中...' : '提问'}
                </button>
            </div>

            {/* 模型信息 */}
            {modelInfo && (
                <div style={{ marginBottom: '10px', color: '#666', fontSize: '12px' }}>
                    {modelInfo}
                </div>
            )}

            {/* AI回答 - 现在支持数学公式了 */}
            {answer && (
                <div style={{
                    background: '#f5f5f5',
                    padding: '20px',
                    borderRadius: '8px',
                    marginTop: '20px',
                    overflow: 'auto',
                    textAlign: 'left'  // 添加左对齐
                }}>
                    <h3>AI回答：</h3>
                    <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            // 让公式显示更大更清晰
                            span: ({ node, ...props }) => {
                                if (props.className === 'katex') {
                                    return <span style={{ fontSize: '1.1em' }} {...props} />;
                                }
                                return <span {...props} />;
                            }
                        }}
                    >
                        {answer}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
}

export default AIAssistant;