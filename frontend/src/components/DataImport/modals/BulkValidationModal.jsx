export const BulkValidationModal = ({ showBulkResults, setShowBulkResults, bulkValidationResults }) => {
    if (!showBulkResults) return null;
    
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
            zIndex: 2000
        }}>
            <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                width: '600px',
                maxWidth: '90%',
                maxHeight: '80%',
                overflow: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>批量验证结果</h3>
                    <button onClick={() => setShowBulkResults(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
                </div>
                
                {bulkValidationResults.map((result, idx) => (
                    <div key={result.questionId} style={{
                        padding: '12px',
                        marginBottom: '8px',
                        border: '1px solid #e8e8e8',
                        borderRadius: '4px',
                        background: result.status === 'done' ? '#f6ffed' : result.status === 'error' ? '#fff2f0' : '#fffbe6'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                            题目 {idx + 1}: 
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                {result.status === 'validating' ? '验证中...' : 
                                 result.status === 'done' ? '✅ 完成' : '❌ 失败'}
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            内容: {result.content}
                        </div>
                        {result.suggestedAnswer && (
                            <div style={{ fontSize: '13px', marginTop: '4px' }}>
                                <strong>🤖 AI建议答案:</strong> {result.suggestedAnswer}
                            </div>
                        )}
                        {result.verdict && (
                            <div style={{ fontSize: '12px', marginTop: '2px', color: 
                                result.verdict === 'correct' ? '#52c41a' : 
                                result.verdict === 'maybe_correct' ? '#fa8c16' : '#f5222d' 
                            }}>
                                投票: {result.verdict === 'correct' ? '全部正确' : 
                                       result.verdict === 'maybe_correct' ? '多数正确' : '答案有误'}
                            </div>
                        )}
                        {result.error && (
                            <div style={{ fontSize: '12px', color: '#f5222d', marginTop: '4px' }}>
                                错误: {result.error}
                            </div>
                        )}
                    </div>
                ))}
                
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                        onClick={() => setShowBulkResults(false)}
                        style={{ background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer' }}
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};