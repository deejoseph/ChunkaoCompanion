// frontend/src/components/Speaking/modules/TOEFL/AddTOEFLTopicModal.jsx
import { useState } from 'react';

const TASK_TYPES = [
    { value: 1, name: '独立口语 (Task 1)', defaultPrep: 15, defaultResp: 45 },
    { value: 2, name: '综合口语 - 校园问题 (Task 2)', defaultPrep: 30, defaultResp: 60 },
    { value: 3, name: '综合口语 - 学术讲座 (Task 3)', defaultPrep: 30, defaultResp: 60 },
    { value: 4, name: '综合口语 - 讲座总结 (Task 4)', defaultPrep: 20, defaultResp: 60 }
];

function AddTOEFLTopicModal({ isOpen, onClose, onAdd }) {
    const [taskType, setTaskType] = useState(1);
    const [question, setQuestion] = useState('');
    const [reading, setReading] = useState('');
    const [listening, setListening] = useState('');
    const [preparationTime, setPreparationTime] = useState(15);
    const [responseTime, setResponseTime] = useState(45);

    const handleTaskTypeChange = (type) => {
        setTaskType(type);
        const task = TASK_TYPES.find(t => t.value === type);
        if (task) {
            setPreparationTime(task.defaultPrep);
            setResponseTime(task.defaultResp);
        }
    };

    const handleSubmit = () => {
        if (!question.trim()) {
            alert('请输入题目内容');
            return;
        }
        const newTopic = {
            taskType,
            taskName: TASK_TYPES.find(t => t.value === taskType).name,
            question: question.trim(),
            reading: reading.trim() || null,
            listening: listening.trim() || null,
            preparationTime,
            responseTime
        };
        onAdd(newTopic);
        onClose();
        // 清空表单
        setQuestion('');
        setReading('');
        setListening('');
        setTaskType(1);
        setPreparationTime(15);
        setResponseTime(45);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }} onClick={onClose}>
            <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                width: '600px',
                maxWidth: '90%',
                maxHeight: '80vh',
                overflow: 'auto'
            }} onClick={(e) => e.stopPropagation()}>
                <h3>➕ 添加托福口语题目</h3>
                
                <div style={{ marginBottom: '16px' }}>
                    <label>题型：</label>
                    <select
                        value={taskType}
                        onChange={(e) => handleTaskTypeChange(parseInt(e.target.value))}
                        style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                    >
                        {TASK_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label>题目问题：</label>
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        rows="3"
                        style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                        placeholder="输入托福口语题目..."
                    />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label>阅读材料（可选，仅 Task 2/3 需要）：</label>
                    <textarea
                        value={reading}
                        onChange={(e) => setReading(e.target.value)}
                        rows="3"
                        style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                        placeholder="输入阅读文本（如校园公告或学术概念）"
                    />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label>听力材料（可选）：</label>
                    <textarea
                        value={listening}
                        onChange={(e) => setListening(e.target.value)}
                        rows="3"
                        style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                        placeholder="输入听力摘要或对话内容"
                    />
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <label>准备时间（秒）：</label>
                        <input
                            type="number"
                            value={preparationTime}
                            onChange={(e) => setPreparationTime(parseInt(e.target.value) || 0)}
                            style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label>答题时间（秒）：</label>
                        <input
                            type="number"
                            value={responseTime}
                            onChange={(e) => setResponseTime(parseInt(e.target.value) || 0)}
                            style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '6px 16px' }}>取消</button>
                    <button onClick={handleSubmit} style={{ padding: '6px 16px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px' }}>添加</button>
                </div>
            </div>
        </div>
    );
}

export default AddTOEFLTopicModal;