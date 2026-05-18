// DataImport/modals/PromptEditModal.jsx
const PromptEditModal = ({ 
    showPromptModal, 
    setShowPromptModal, 
    detectedInfo, 
    topicName, 
    localPrompt, 
    setLocalPrompt, 
    isBatchValidation, 
    batchQuestions, 
    onConfirm 
}) => {
    if (!showPromptModal) return null;

    const getSpecificDisplay = () => {
        const specificType = detectedInfo.specificType;
        if (specificType === '选择题') return '选择题';
        if (specificType === '默写题') return '默写题';
        if (specificType === '填空题') return '填空题';
        if (specificType === '问答题') return '问答题';
        return detectedInfo.specificType || '未知';
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100
        }}>
            <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                width: '700px',
                maxWidth: '90%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>✏️ AI 验证提示词</h3>
                    <button onClick={() => setShowPromptModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
                </div>
                
                <div style={{
                    background: '#f0f7ff',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px'
                }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>📚 学科：<strong>{detectedInfo.subject}</strong></span>
                        <span>📝 题型：<strong>{detectedInfo.questionType}</strong></span>
                        <span>🏷️ 细分：<strong>{getSpecificDisplay()}</strong></span>
                        {topicName && <span>📁 专题：<strong>{topicName}</strong></span>}
                    </div>
                </div>
                
                <div style={{ marginBottom: '16px', flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                        验证提示词（可直接编辑修改）
                    </label>
                    <textarea
                        value={localPrompt}
                        onChange={(e) => setLocalPrompt(e.target.value)}
                        rows={12}
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            borderRadius: '8px',
                            border: '1px solid #d9d9d9',
                            resize: 'vertical'
                        }}
                        placeholder="可以在这里编辑或修改提示词..."
                    />
                </div>
                
                <div style={{
                    background: '#f6ffed',
                    padding: '10px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#52c41a',
                    border: '1px solid #b7eb8f'
                }}>
                    💡 提示：提示词越具体，AI回答越准确。可以根据题目特点添加额外要求。
                </div>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => setShowPromptModal(false)}
                        style={{ padding: '8px 20px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        取消
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{ padding: '8px 20px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {isBatchValidation ? `开始验证 ${batchQuestions.length} 道题目` : '开始验证'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromptEditModal;