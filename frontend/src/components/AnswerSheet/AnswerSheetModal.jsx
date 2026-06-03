import { useState } from 'react';

function AnswerSheetModal({ onClose, bankList, selectedBankId, onBankChange, questions, maxScore, loading, onSubmit }) {
    const [answers, setAnswers] = useState({});

    // 初始化或题库切换时重置批改状态
    const [localAnswers, setLocalAnswers] = useState({});

    // 当题库变化时重置本地答案
    if (questions.length > 0 && Object.keys(localAnswers).length === 0 && !loading) {
        const init = {};
        questions.forEach(q => { init[q.id] = 'correct'; });
        setLocalAnswers(init);
    }

    const toggleAnswer = (questionId) => {
        setLocalAnswers(prev => ({
            ...prev,
            [questionId]: prev[questionId] === 'correct' ? 'wrong' : 'correct'
        }));
    };

    const handleSubmit = () => {
        onSubmit(localAnswers);
    };

    const correctCount = Object.values(localAnswers).filter(v => v === 'correct').length;
    const wrongCount = questions.length - correctCount;

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
                width: '500px',
                maxWidth: '90%',
                maxHeight: '80%',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0 }}>答题卡</h3>
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
                            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                <span>✅ 正确：{correctCount}</span>
                                <span>❌ 错误：{wrongCount}</span>
                                <span>总分：{maxScore}分</span>
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '8px', padding: '8px' }}>
                                {questions.map((q, idx) => (
                                    <div key={q.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px',
                                        borderBottom: '1px solid #f0f0f0',
                                        cursor: 'pointer'
                                    }} onClick={() => toggleAnswer(q.id)}>
                                        <span>第 {q.number} 题</span>
                                        <span style={{ fontSize: '24px' }}>
                                            {localAnswers[q.id] === 'correct' ? '✅' : '❌'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={handleSubmit} style={{ background: '#1890ff', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}>
                                    提交批改
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AnswerSheetModal;