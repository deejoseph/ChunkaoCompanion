import { useState, useEffect } from 'react';
import axios from 'axios';
import AnswerSheetModal from './AnswerSheetModal';

function AnswerSheetFloatingButton() {
    const [visible, setVisible] = useState(false);
    const [bankList, setBankList] = useState([]);
    const [selectedBankId, setSelectedBankId] = useState('');
    const [questions, setQuestions] = useState([]);
    const [maxScore, setMaxScore] = useState(0);
    const [loading, setLoading] = useState(false);

    // 加载题库列表（用于选择要批改的试卷）
    useEffect(() => {
        const loadBanks = async () => {
            try {
                const res = await axios.get('http://localhost:3001/api/banks/list');
                if (res.data.success) {
                    const banks = res.data.banks;
                    // 按年份升序排序（无效年份放最后）
                    banks.sort((a, b) => (a.year || 0) - (b.year || 0));
                    setBankList(banks);
                }
            } catch (err) {
                console.error(err);
            }
        };
        loadBanks();
    }, []);

    const handleBankChange = async (bankId) => {
        setSelectedBankId(bankId);
        if (!bankId) return;
        setLoading(true);
        try {
            const res = await axios.get(`http://localhost:3001/api/answer-sheet/questions/${bankId}`);
            if (res.data.success) {
                setQuestions(res.data.questions);
                setMaxScore(res.data.maxScore);
            } else {
                alert('加载题目失败');
            }
        } catch (err) {
            console.error(err);
            alert('加载题目出错');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (answers) => {
        // answers: { [questionId]: 'correct' or 'wrong' }
        try {
            const res = await axios.post('http://localhost:3001/api/answer-sheet/submit', {
                bankId: selectedBankId,
                answers
            });
            if (res.data.success) {
                alert(`批改完成！得分：${res.data.totalScore}/${res.data.maxScore}\n错题数：${res.data.wrongCount}\n涉及专题：${res.data.topics.map(t => t.name).join(', ')}`);
                setVisible(false);
                // 可以触发一个全局事件更新学生画像
                window.dispatchEvent(new CustomEvent('answerSheetSubmitted', { detail: res.data }));
            } else {
                alert('提交失败：' + res.data.error);
            }
        } catch (err) {
            console.error(err);
            alert('提交出错');
        }
    };

    return (
        <>
            {/* 悬浮按钮 */}
            <button
                onClick={() => setVisible(true)}
                style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#1890ff',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    fontSize: '24px',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                title="答题卡"
            >
                📝
            </button>

            {/* 弹窗 */}
            {visible && (
                <AnswerSheetModal
                    onClose={() => setVisible(false)}
                    bankList={bankList}
                    selectedBankId={selectedBankId}
                    onBankChange={handleBankChange}
                    questions={questions}
                    maxScore={maxScore}
                    loading={loading}
                    onSubmit={handleSubmit}
                />
            )}
        </>
    );
}

export default AnswerSheetFloatingButton;