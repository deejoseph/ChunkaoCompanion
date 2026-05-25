import { useState } from 'react';

function AddTopicModal({ isOpen, onClose, onAdd }) {
    const [question, setQuestion] = useState('');
    const [category, setCategory] = useState('自定义');

    const handleSubmit = () => {
        if (!question.trim()) {
            alert('请输入话题内容');
            return;
        }
        onAdd(question.trim(), category.trim() || '自定义');
        setQuestion('');
        setCategory('自定义');
        onClose();
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
                width: '500px',
                maxWidth: '90%'
            }} onClick={(e) => e.stopPropagation()}>
                <h3>➕ 添加自定义话题</h3>
                <div style={{ marginBottom: '16px' }}>
                    <label>问题：</label>
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        rows="3"
                        style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                        placeholder="例如：Describe a memorable event in your life."
                    />
                </div>
                <div style={{ marginBottom: '24px' }}>
                    <label>分类（可选）：</label>
                    <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                        placeholder="例如：雅思Part2, 自定义"
                    />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '6px 16px' }}>取消</button>
                    <button onClick={handleSubmit} style={{ padding: '6px 16px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px' }}>添加</button>
                </div>
            </div>
        </div>
    );
}

export default AddTopicModal;