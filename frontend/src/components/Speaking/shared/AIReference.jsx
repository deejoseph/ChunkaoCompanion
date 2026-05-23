import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = 'http://localhost:3001';

// 预设的四个英语模型
const AI_MODELS = [
    { id: 'qwen2.5:7b', name: '小明', color: '#1890ff', description: '快速响应，适合基础练习' },
    { id: 'qwen2.5:14b', name: '小红', color: '#52c41a', description: '回答详细，适合深度分析' },
    { id: 'glm4:9b', name: '小刚', color: '#722ed1', description: '逻辑清晰，适合难题' },
    { id: 'gemma3:4b', name: '小美', color: '#fa8c16', description: '英语地道，发音标准' }
];

function AIReference({ currentQuestion, context, onClose }) {
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState({});
    const [generatingAll, setGeneratingAll] = useState(false);

    const generateAnswer = async (modelId, modelName) => {
        if (loading[modelId]) return;
        
        setLoading(prev => ({ ...prev, [modelId]: true }));
        
        let prompt = '';
        
        // 根据上下文构建不同的提示词
        if (context === 'ielts_part1') {
            prompt = `你是雅思考生${modelName}。请用英语回答以下雅思口语 Part 1 问题：

问题：${currentQuestion}

要求：
1. 回答长度 2-3 句话
2. 自然、口语化
3. 直接回答问题，不要绕弯子
4. 可以适当使用 well, I think, actually 等连接词

请直接输出你的回答：`;
        } else if (context === 'ielts_part2') {
            prompt = `你是雅思考生${modelName}。请用英语回答以下雅思口语 Part 2 话题：

话题：${currentQuestion}

要求：
1. 回答长度 1.5-2 分钟（约 200-300 词）
2. 结构清晰：开头介绍 → 主体内容 → 结尾总结
3. 自然、口语化，不要像背诵
4. 包含具体例子和个人感受

请直接输出你的回答：`;
        } else if (context === 'ielts_part3') {
            prompt = `你是雅思考生${modelName}。请用英语回答以下雅思口语 Part 3 抽象话题：

问题：${currentQuestion}

要求：
1. 回答长度 3-5 句话
2. 表达观点并给出理由
3. 可以用例子支持
4. 展现批判性思维

请直接输出你的回答：`;
        } else {
            prompt = `你是雅思考生${modelName}。请用英语回答以下口语问题：

问题：${currentQuestion}

要求：
1. 自然、口语化
2. 回答长度 30-60 秒
3. 包含 2-3 个要点

请直接输出你的回答：`;
        }
        
        try {
            const response = await axios.post(`${API_BASE}/api/ai/ask`, {
                subject: 'english',
                question: prompt,
                model: modelId
            });
            
            if (response.data.success) {
                setAnswers(prev => ({ ...prev, [modelId]: response.data.answer }));
            } else {
                setAnswers(prev => ({ ...prev, [modelId]: `生成失败: ${response.data.error}` }));
            }
        } catch (error) {
            console.error('生成失败:', error);
            setAnswers(prev => ({ ...prev, [modelId]: `生成失败: ${error.message}` }));
        } finally {
            setLoading(prev => ({ ...prev, [modelId]: false }));
        }
    };

    const generateAll = async () => {
        setGeneratingAll(true);
        for (const model of AI_MODELS) {
            if (!answers[model.id]) {
                await generateAnswer(model.id, model.name);
                // 间隔 500ms 避免请求过快
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        setGeneratingAll(false);
    };

    return (
        <div style={{
            position: 'fixed',
            right: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 400,
            maxHeight: '85vh',
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* 头部 */}
            <div style={{
                padding: '12px 16px',
                background: '#1890ff',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ fontWeight: 'bold' }}>🤖 AI 参考答案</span>
                <button onClick={onClose} style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: 20,
                    cursor: 'pointer'
                }}>×</button>
            </div>

            {/* 内容区域 */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 16
            }}>
                {/* 当前问题 */}
                <div style={{
                    background: '#f0f7ff',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 14,
                    lineHeight: 1.5
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 6 }}>🎯 当前问题</div>
                    {currentQuestion}
                </div>

                {/* 生成全部按钮 */}
                <button
                    onClick={generateAll}
                    disabled={generatingAll}
                    style={{
                        width: '100%',
                        padding: 8,
                        background: generatingAll ? '#ccc' : '#52c41a',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: generatingAll ? 'not-allowed' : 'pointer',
                        marginBottom: 16,
                        fontWeight: 'bold'
                    }}
                >
                    {generatingAll ? '生成中...' : '🚀 生成所有参考答案'}
                </button>

                {/* 四个模型的回答 */}
                {AI_MODELS.map(model => (
                    <div key={model.id} style={{
                        marginBottom: 16,
                        border: `1px solid ${model.color}20`,
                        borderRadius: 8,
                        overflow: 'hidden'
                    }}>
                        {/* 模型标题 */}
                        <div style={{
                            padding: '10px 12px',
                            background: `${model.color}10`,
                            borderBottom: `1px solid ${model.color}20`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8
                        }}>
                            <div>
                                <span style={{
                                    fontWeight: 'bold',
                                    color: model.color
                                }}>🧑‍🎓 {model.name}</span>
                                <span style={{
                                    fontSize: 11,
                                    color: '#999',
                                    marginLeft: 8
                                }}>{model.description}</span>
                            </div>
                            {!answers[model.id] && !loading[model.id] && (
                                <button
                                    onClick={() => generateAnswer(model.id, model.name)}
                                    style={{
                                        padding: '4px 12px',
                                        background: model.color,
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontSize: 12
                                    }}
                                >
                                    生成
                                </button>
                            )}
                            {loading[model.id] && (
                                <span style={{ fontSize: 12, color: model.color }}>生成中...</span>
                            )}
                        </div>

                        {/* 回答内容 */}
                        {answers[model.id] && (
                            <div style={{
                                padding: 12,
                                fontSize: 13,
                                lineHeight: 1.6,
                                background: '#fafafa',
                                maxHeight: 200,
                                overflow: 'auto'
                            }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {answers[model.id]}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                ))}

                {/* 使用提示 */}
                <div style={{
                    fontSize: 11,
                    color: '#999',
                    textAlign: 'center',
                    padding: 12,
                    borderTop: '1px solid #eee',
                    marginTop: 8
                }}>
                    💡 参考答案由 AI 生成，仅供参考。建议结合自己的表达习惯修改。
                </div>
            </div>
        </div>
    );
}

export default AIReference;