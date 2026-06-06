import { useState, useEffect } from 'react';

function AnswerSheetModal({ onClose, bankList, selectedBankId, onBankChange, questions, maxScore, loading, onSubmit }) {
    // localAnswers: { [questionId]: number } — 学生自评得分
    const [localAnswers, setLocalAnswers] = useState({});

    // 当 questions 列表变化时，初始化为满分（全对）
    useEffect(() => {
        if (questions.length > 0) {
            const init = {};
            questions.forEach(q => {
                init[q.id] = q.score || 0;
            });
            setLocalAnswers(init);
        } else {
            setLocalAnswers({});
        }
    }, [questions]);

    const handleScoreChange = (questionId, value, maxVal) => {
        const num = parseFloat(value);
        if (isNaN(num)) {
            setLocalAnswers(prev => ({ ...prev, [questionId]: 0 }));
            return;
        }
        const clamped = Math.min(Math.max(0, num), maxVal);
        setLocalAnswers(prev => ({ ...prev, [questionId]: clamped }));
    };

    const handleSubmit = () => {
        onSubmit(localAnswers);
    };

    // 计算总得分
    const totalScored = Object.values(localAnswers).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const totalMax = questions.reduce((s, q) => s + (q.score || 0), 0);

    // 检查分值是否可能有误（上海春考标准满分150分，实际合计偏差超过2分则提示）
    const scoreMismatch = totalMax > 0 && Math.abs(totalMax - 150) > 2;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100
        }}>
            <div style={{
                background: 'white',
                width: '560px',
                maxWidth: '90%',
                maxHeight: '85%',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>答题卡 - 自评得分</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ padding: '16px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <label>选择试卷：</label>
                        <select value={selectedBankId} onChange={(e) => onBankChange(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '8px' }}>
                            <option value="">-- 请选择 --</option>
                            {bankList.map(bank => (
                                <option key={bank.id} value={bank.id}>{bank.title} ({bank.totalQuestions}题)</option>
                            ))}
                        </select>
                    </div>

                    {loading && <div>加载题目中...</div>}

                    {!loading && questions.length > 0 && (
                        <>
                            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', background: '#f6f8fa', padding: '10px 14px', borderRadius: '8px' }}>
                                <span>自评总分：<strong style={{ color: '#1890ff', fontSize: '18px' }}>{totalScored.toFixed(1)}</strong> / {totalMax} 分</span>
                                <span>得分率：<strong style={{ color: totalMax > 0 && totalScored / totalMax >= 0.6 ? '#52c41a' : '#f5222d' }}>{totalMax > 0 ? (totalScored / totalMax * 100).toFixed(1) : 0}%</strong></span>
                            </div>

                            {scoreMismatch && (
                                <div style={{ marginBottom: '8px', padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '6px', fontSize: '12px', color: '#ad6800' }}>
                                    ⚠️ 提示：当前试卷分值合计({totalMax}分)与标准满分(150分)存在差异，原始数据中的分值可能有误，仅供参考。
                                </div>
                            )}

                            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#999' }}>
                                每题默认满分为自评得分，修改为你实际评估的得分值
                            </div>

                            <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '8px' }}>
                                {questions.map((q, idx) => {
                                    const scored = parseFloat(localAnswers[q.id]) || 0;
                                    const qMax = q.score || 0;
                                    const isFullScore = scored >= qMax && qMax > 0;
                                    const isZero = scored === 0 && qMax > 0;
                                    return (
                                        <div key={q.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid #f5f5f5',
                                            background: isFullScore ? '#f6ffed' : isZero ? '#fff2f0' : '#fffbe6'
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ fontWeight: 500 }}>第 {q.number} 题</span>
                                                <span style={{ color: '#999', marginLeft: '8px', fontSize: '12px' }}>满分 {qMax} 分</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={qMax}
                                                    step="0.5"
                                                    value={localAnswers[q.id] !== undefined ? localAnswers[q.id] : qMax}
                                                    onChange={(e) => handleScoreChange(q.id, e.target.value, qMax)}
                                                    style={{
                                                        width: '60px',
                                                        padding: '4px 6px',
                                                        border: '1px solid #d9d9d9',
                                                        borderRadius: '4px',
                                                        textAlign: 'center',
                                                        fontSize: '14px',
                                                        outline: 'none'
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span style={{ fontSize: '12px', color: '#999' }}>/ {qMax}</span>
                                                <span style={{ fontSize: '16px', marginLeft: '6px' }}>
                                                    {isFullScore ? '✅' : isZero ? '❌' : '⚠️'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button onClick={onClose} style={{ background: '#f5f5f5', border: '1px solid #d9d9d9', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                                    取消
                                </button>
                                <button onClick={handleSubmit} style={{ background: '#1890ff', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}>
                                    提交批改
                                </button>
                            </div>
                        </>
                    )}

                    {!loading && questions.length === 0 && selectedBankId && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                            请选择一份试卷开始自评
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AnswerSheetModal;