export const AIAssistantToolbar = ({ 
    questionId, 
    showFormulaInput, 
    setShowFormulaInput, 
    formulaLatex, 
    setFormulaLatex, 
    uploading,
    textOcrUploading,
    currentEditingQuestionId,
    setCurrentEditingQuestionId,
    handleFormulaUpload,
    handleTextImageUpload,
    updateQuestion,
    questions
}) => (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <button
            onClick={() => setShowFormulaInput(!showFormulaInput)}
            style={{
                padding: '4px 10px',
                background: showFormulaInput ? '#1890ff' : '#f0f0f0',
                color: showFormulaInput ? 'white' : '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
            }}
        >
            📐 手动输入公式
        </button>
        <label style={{
            padding: '4px 10px',
            background: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'inline-block'
        }}>
            📸 拍照识别公式
            <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    setCurrentEditingQuestionId(questionId);
                    handleFormulaUpload(e);
                    e.target.value = '';
                }}
                disabled={uploading}
            />
        </label>
        <label style={{
            padding: '4px 10px',
            background: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'inline-block'
        }}>
            📄 拍照识别图文
            <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    setCurrentEditingQuestionId(questionId);
                    handleTextImageUpload(e.target.files[0]);
                    e.target.value = '';
                }}
                disabled={textOcrUploading}
            />
        </label>
        {uploading && <span style={{ fontSize: '12px', color: '#ff6600' }}>识别中...</span>}
        
        {showFormulaInput && (
            <div style={{ marginTop: '8px', width: '100%' }}>
                <textarea
                    placeholder="输入LaTeX公式，如: \frac{1}{2}"
                    rows={2}
                    value={formulaLatex}
                    onChange={(e) => setFormulaLatex(e.target.value)}
                    style={{ width: '100%', padding: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                />
                <div style={{ marginTop: '4px' }}>
                    <button
                        onClick={() => {
                            if (formulaLatex) {
                                const currentQuestion = questions.find(q => q.id === questionId);
                                if (currentQuestion) {
                                    updateQuestion(questionId, 'content', currentQuestion.content + formulaLatex);
                                }
                                setFormulaLatex('');
                                setShowFormulaInput(false);
                            }
                        }}
                        style={{ padding: '2px 8px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                        插入
                    </button>
                </div>
            </div>
        )}
    </div>
);