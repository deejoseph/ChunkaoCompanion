import React, { useState } from 'react';
import TextEditorWithShortcuts from './TextEditorWithShortcuts';

/**
 * 答案编辑器组件 - 用于编辑四层答案
 */
const AnswerEditor = ({ question, onUpdate, onClose }) => {
    const [editingField, setEditingField] = useState(null);
    const [editValues, setEditValues] = useState({
        sourceAnswer: question.sourceAnswer || '',
        finalAnswer: question.finalAnswer || '',
        discussion: question.discussion || ''
    });

    const handleSave = (field) => {
        onUpdate(field, editValues[field]);
        setEditingField(null);
    };

    const handleCancel = () => {
        setEditingField(null);
        setEditValues({
            sourceAnswer: question.sourceAnswer || '',
            finalAnswer: question.finalAnswer || '',
            discussion: question.discussion || ''
        });
    };

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
            zIndex: 3000
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
                    <h3 style={{ margin: 0 }}>答案编辑器</h3>
                    <button 
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
                    >
                        ×
                    </button>
                </div>

                {/* 参考答案 */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 'bold', color: '#fa8c16' }}>📖 参考答案（原试卷）</label>
                    {editingField === 'sourceAnswer' ? (
                        <div>
                            <TextEditorWithShortcuts
                                value={editValues.sourceAnswer}
                                onChange={(e) => setEditValues({ ...editValues, sourceAnswer: e.target.value })}
                                rows={3}
                                placeholder="输入原试卷答案..."
                            />
                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleSave('sourceAnswer')}
                                    style={{
                                        background: '#52c41a',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 16px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    保存
                                </button>
                                <button
                                    onClick={handleCancel}
                                    style={{
                                        background: '#f0f0f0',
                                        border: 'none',
                                        padding: '6px 16px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            background: '#fff7e6',
                            padding: '10px',
                            borderRadius: '4px',
                            marginTop: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{ flex: 1, wordBreak: 'break-all' }}>
                                {question.sourceAnswer || '暂无'}
                            </div>
                            <button
                                onClick={() => setEditingField('sourceAnswer')}
                                style={{
                                    background: '#fa8c16',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    marginLeft: '8px'
                                }}
                            >
                                编辑
                            </button>
                        </div>
                    )}
                </div>

                {/* 我的答案 */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 'bold', color: '#1890ff' }}>✅ 我的答案（讨论后确定）</label>
                    {editingField === 'finalAnswer' ? (
                        <div>
                            <TextEditorWithShortcuts
                                value={editValues.finalAnswer}
                                onChange={(e) => setEditValues({ ...editValues, finalAnswer: e.target.value })}
                                rows={3}
                                placeholder="输入讨论后确定的答案..."
                            />
                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleSave('finalAnswer')}
                                    style={{
                                        background: '#52c41a',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 16px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    保存
                                </button>
                                <button
                                    onClick={handleCancel}
                                    style={{
                                        background: '#f0f0f0',
                                        border: 'none',
                                        padding: '6px 16px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            background: '#e6f7ff',
                            padding: '10px',
                            borderRadius: '4px',
                            marginTop: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{ flex: 1, wordBreak: 'break-all' }}>
                                {question.finalAnswer || '暂无'}
                            </div>
                            <button
                                onClick={() => setEditingField('finalAnswer')}
                                style={{
                                    background: '#1890ff',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    marginLeft: '8px'
                                }}
                            >
                                编辑
                            </button>
                        </div>
                    )}
                </div>

                {/* 讨论记录 */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 'bold', color: '#eb2f96' }}>💬 讨论记录</label>
                    {editingField === 'discussion' ? (
                        <div>
                            <TextEditorWithShortcuts
                                value={editValues.discussion}
                                onChange={(e) => setEditValues({ ...editValues, discussion: e.target.value })}
                                rows={3}
                                placeholder="记录讨论要点或决策理由..."
                            />
                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleSave('discussion')}
                                    style={{
                                        background: '#52c41a',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 16px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    保存
                                </button>
                                <button
                                    onClick={handleCancel}
                                    style={{
                                        background: '#f0f0f0',
                                        border: 'none',
                                        padding: '6px 16px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            background: '#fff0f6',
                            padding: '10px',
                            borderRadius: '4px',
                            marginTop: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{ flex: 1, wordBreak: 'break-all', fontSize: '13px', color: '#666' }}>
                                {question.discussion || '暂无'}
                            </div>
                            <button
                                onClick={() => setEditingField('discussion')}
                                style={{
                                    background: '#eb2f96',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    marginLeft: '8px'
                                }}
                            >
                                编辑
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#1890ff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 20px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnswerEditor;
