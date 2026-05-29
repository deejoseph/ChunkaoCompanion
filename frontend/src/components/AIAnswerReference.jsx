import { useState, useEffect } from 'react';
import axios from 'axios';
import { getModelNickname } from '../utils/nicknameHelper';

function AIAnswerReference({ currentTopic, subject }) {
    const [isOpen, setIsOpen] = useState(false);
    const [bank, setBank] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sourceAnswersMap, setSourceAnswersMap] = useState({});
    const [sourceAnswersBankId, setSourceAnswersBankId] = useState(null);

    useEffect(() => {
        if (isOpen && currentTopic) {
            loadData();
        }
    }, [isOpen, currentTopic, subject]);

    const getModelColor = (model) => {
        const colors = {
            'qwen2.5:7b': '#1890ff',
            'qwen2.5:14b': '#52c41a',
            'glm4:9b': '#722ed1',
            'qwen2.5-coder-fast': '#eb2f96',
            'qwen2-math:1.5b': '#13c2c2',
            'qwen2-math:7b': '#fa8c16',
            'gemma3:4b': '#2f54eb'
        };
        return colors[model] || '#999';
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            // 1. 从 JSON 加载 AI 参考答案
            let searchTitle = currentTopic;
            searchTitle = searchTitle.replace(/（教师版）/, '');
            searchTitle = searchTitle.replace(/（学生版）/, '');
            searchTitle = searchTitle.replace(/（复习讲义）/, '');
            searchTitle = searchTitle.replace(/（上海专用）/, '');
            searchTitle = searchTitle.replace(/\(教师版\)/, '');
            searchTitle = searchTitle.replace(/\(学生版\)/, '');
            searchTitle = searchTitle.trim();

            console.log('搜索标题:', searchTitle);

            const jsonUrl = `http://localhost:3001/api/banks/search?subject=${subject}&title=${encodeURIComponent(searchTitle)}&_=${Date.now()}`;
            const jsonResponse = await axios.get(jsonUrl);
            
            let bankData = null;
            if (jsonResponse.data.success && jsonResponse.data.bank) {
                bankData = jsonResponse.data.bank;
            }
            
            if (!bankData) {
                setError('未找到 AI 验证答案库\n专题名称：' + searchTitle);
                setLoading(false);
                return;
            }
            
            // 2. 从数据库获取原试卷答案（source_answer）
            const dbUrl = `http://localhost:3001/api/knowledge/source-answers?subject=${subject}&title=${encodeURIComponent(currentTopic)}&_=${Date.now()}`;
            const dbResponse = await axios.get(dbUrl);
            
            const answersMap = {};
            if (dbResponse.data.success && dbResponse.data.answers) {
                dbResponse.data.answers.forEach(item => {
                    // 统一转为字符串类型
                    answersMap[String(item.number)] = item.source_answer;
                });
            }
            setSourceAnswersBankId(dbResponse.data.bankId || null);
            
            console.log('数据库原试卷答案映射:', answersMap);
            console.log('第一个题目的编号:', bankData.questions[0]?.number, '类型:', typeof bankData.questions[0]?.number);
            
            setSourceAnswersMap(answersMap);
            setBank(bankData);
            
        } catch (err) {
            console.error('加载失败:', err);
            setError('加载失败: ' + err.message);
        }
        setLoading(false);
    };

    const updateAnswerInDatabase = async (questionNumber, newAnswer) => {
        try {
            const bankId = sourceAnswersBankId || bank?.paperId || bank?.id;
            
            const response = await axios.post('http://localhost:3001/api/banks/update-answer', {
                questionNumber: questionNumber,
                bankId: bankId,
                sourceAnswer: newAnswer
            });
            
            if (response.data.success) {
                // 更新本地映射
                setSourceAnswersMap(prev => ({
                    ...prev,
                    [String(questionNumber)]: newAnswer
                }));
                alert('答案已修正！');
            } else {
                alert('修正失败: ' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('更新答案失败:', error);
            alert('更新失败，请检查网络');
        }
    };

    const formatAnswer = (answer) => {
        if (!answer) return '暂无';
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
                                
                                {bank.questions.map((q, idx) => {
                                    const questionNumber = idx + 1;
                                    const sourceAnswer = sourceAnswersMap[String(questionNumber)] || '';

                                    return (
                                        <div key={idx} style={{
                                            marginBottom: '20px',
                                            padding: '12px',
                                            borderBottom: '1px solid #eee',
                                            background: '#fafafa',
                                            borderRadius: '8px'
                                        }}>
                                            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1890ff' }}>
                                                题目 {questionNumber}
                                            </div>
                                            <div style={{ fontSize: '13px', marginBottom: '8px', color: '#333', lineHeight: '1.6' }}>
                                                {q.content}
                                            </div>

                                            {/* 原试卷答案区域 */}
                                            <div style={{
                                                background: '#f6ffed',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                marginTop: '8px',
                                                borderLeft: '3px solid #52c41a'
                                            }}>
                                                <div style={{ color: '#52c41a', fontWeight: 'bold', marginBottom: '4px' }}>
                                                    📖 原试卷答案
                                                </div>
                                                <div>{formatAnswer(sourceAnswer)}</div>

                                                {/* 其他同学的想法（AI 答案） */}
                                                {q.aiAnswers && Object.keys(q.aiAnswers).length > 0 && (
                                                    <details style={{ marginTop: '8px' }}>
                                                        <summary style={{ fontSize: '12px', color: '#999', cursor: 'pointer' }}>🤖 AI 同学的想法（仅供参考）</summary>
                                                        <div style={{ marginTop: '6px' }}>
                                                            {Object.entries(q.aiAnswers).map(([model, answer]) => (
                                                                <div key={model} style={{ fontSize: '12px', marginTop: '4px', padding: '4px', background: '#fff', borderRadius: '4px' }}>
                                                                    <strong style={{ color: getModelColor(model) }}>
                                                                        🧑‍🎓 {getModelNickname(subject, model)}
                                                                    </strong>: {answer}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </details>
                                                )}

                                                {/* 修正按钮 */}
                                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #d9d9d9' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                                                        <button
                                                            onClick={() => {
                                                                const currentAnswers = sourceAnswer;
                                                                const newAnswer = window.prompt(
                                                                    '请用【空格】分隔每个答案\n\n示例：虽与日月争光可也 纵一苇之所如 赤壁赋 万里悲秋常作客 百年多病独登台\n\n注意：答案内部请不要包含空格\n\n当前答案：',
                                                                    currentAnswers
                                                                );
                                                                if (newAnswer !== null && newAnswer.trim()) {
                                                                    updateAnswerInDatabase(questionNumber, newAnswer.trim());
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '2px 10px',
                                                                background: '#fa8c16',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '11px'
                                                            }}
                                                        >
                                                            ✏️ 修正答案
                                                        </button>
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>
                                                        💡 提示：点击修正可更新数据库中的标准答案
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
