import { useState, useEffect } from 'react';
import axios from 'axios';

function AIAnswerReference({ currentTopic, subject }) {
    const [isOpen, setIsOpen] = useState(false);
    const [bank, setBank] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && currentTopic) {
            loadAnswerBank();
        }
    }, [isOpen, currentTopic, subject]);

    const loadAnswerBank = async () => {
        setLoading(true);
        setError(null);
        try {
            // 提取核心专题名称（去掉所有后缀）
            let searchTitle = currentTopic;

            // 去掉各种后缀
            searchTitle = searchTitle.replace(/（教师版）/, '');
            searchTitle = searchTitle.replace(/（学生版）/, '');
            searchTitle = searchTitle.replace(/（复习讲义）/, '');
            searchTitle = searchTitle.replace(/（上海专用）/, '');
            searchTitle = searchTitle.replace(/\(教师版\)/, '');
            searchTitle = searchTitle.replace(/\(学生版\)/, '');
            searchTitle = searchTitle.trim();

            console.log('原始专题名:', currentTopic);
            console.log('搜索用专题名:', searchTitle);

            const response = await axios.get('http://localhost:3001/api/banks/search', {
                params: {
                    subject: subject,
                    title: searchTitle
                }
            });

            if (response.data.success && response.data.bank) {
                setBank(response.data.bank);
            } else {
                // 尝试模糊匹配：只取前几个字
                const shortTitle = searchTitle.substring(0, 10);
                const response2 = await axios.get('http://localhost:3001/api/banks/search', {
                    params: {
                        subject: subject,
                        title: shortTitle
                    }
                });
                if (response2.data.success && response2.data.bank) {
                    setBank(response2.data.bank);
                } else {
                    setError('未找到 AI 验证答案库\n专题名称：' + searchTitle);
                }
            }
        } catch (err) {
            console.error('加载答案库失败:', err);
            setError('加载失败');
        }
        setLoading(false);
    };
    
    // 格式化答案显示
    const formatAnswer = (answer) => {
        if (Array.isArray(answer)) {
            return answer.join(' / ');
        }
        return answer;
    };

    return (
        <>
            {/* 悬浮按钮 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    right: '20px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#1890ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px 0 0 8px',
                    padding: '12px 8px',
                    writingMode: 'vertical-rl',
                    cursor: 'pointer',
                    zIndex: 999,
                    boxShadow: '-2px 2px 8px rgba(0,0,0,0.1)',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}
            >
                🤖 AI参考答案
            </button>

            {/* 侧边栏 */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    right: 0,
                    top: 0,
                    width: '420px',
                    height: '100vh',
                    background: 'white',
                    boxShadow: '-2px 0 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'auto'
                }}>
                    {/* 标题栏 */}
                    <div style={{
                        padding: '16px',
                        background: '#1890ff',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'sticky',
                        top: 0
                    }}>
                        <span style={{ fontWeight: 'bold' }}>🤖 AI 参考答案</span>
                        <button 
                            onClick={() => setIsOpen(false)} 
                            style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}
                        >
                            ×
                        </button>
                    </div>
                    
                    {/* 内容区域 */}
                    <div style={{ padding: '16px', flex: 1 }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
                        ) : error ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                {error}
                                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                                    请先在「新资料采集」中导入并 AI 验证答案
                                </div>
                            </div>
                        ) : bank ? (
                            <div>
                                <div style={{
                                    background: '#f0f7ff',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    marginBottom: '16px'
                                }}>
                                    <div><strong>专题：</strong> {bank.title}</div>
                                    <div><strong>学科：</strong> {bank.subject}</div>
                                    <div><strong>版本：</strong> {bank.version}</div>
                                    <div><strong>题目数量：</strong> {bank.totalQuestions}</div>
                                </div>
                                
                                {bank.questions.map((q, idx) => (
                                    <div key={idx} style={{
                                        marginBottom: '20px',
                                        padding: '12px',
                                        borderBottom: '1px solid #eee',
                                        background: '#fafafa',
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1890ff' }}>
                                            题目 {idx + 1}
                                        </div>
                                        <div style={{ fontSize: '13px', marginBottom: '8px', color: '#333', lineHeight: '1.6' }}>
                                            {q.content}
                                        </div>
                                        <div style={{
                                            background: '#f6ffed',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            marginTop: '8px',
                                            borderLeft: '3px solid #52c41a'
                                        }}>
                                            <div style={{ color: '#52c41a', fontWeight: 'bold', marginBottom: '4px' }}>
                                                📖 参考答案
                                            </div>
                                            <div>{formatAnswer(q.finalAnswer || q.aiSuggestedAnswer || q.answer)}</div>
                                            {q.aiSuggestedAnswer && (
                                                <div style={{ marginTop: '6px', color: '#1890ff', fontSize: '12px' }}>
                                                    <strong>AI suggested: </strong>{formatAnswer(q.aiSuggestedAnswer)}
                                                </div>
                                            )}
                                            {q.sourceAnswer && (
                                                <div style={{ marginTop: '6px', color: '#666', fontSize: '12px' }}>
                                                    <strong>Source answer: </strong>{formatAnswer(q.sourceAnswer)}
                                                </div>
                                            )}
                                            {q.analysis && (
                                                <div style={{ marginTop: '8px', color: '#666', fontSize: '12px' }}>
                                                    <strong>解析：</strong>{q.analysis}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    
                    {/* 底部提示 */}
                    <div style={{
                        padding: '12px',
                        borderTop: '1px solid #eee',
                        fontSize: '11px',
                        color: '#999',
                        textAlign: 'center',
                        background: '#fafafa'
                    }}>
                        💡 答案由 AI 交叉验证生成，仅供参考
                    </div>
                </div>
            )}
        </>
    );
}

export default AIAnswerReference;
