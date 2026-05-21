// 从 DataImport.jsx 中复制内联的 AIAssistantToolbar 组件到这里
// 改为独立导出
import { useState, useRef } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

const AIAssistantToolbar = ({ questionId, onAIAnalyzed }) => {
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [showCustomPrompt, setShowCustomPrompt] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const popupRef = useRef(null);

    // 分析单个题目
    const analyzeWithAI = async (customPromptText = null) => {
        setAnalyzing(true);
        try {
            // 获取题目内容
            const questionElement = document.getElementById(`question-content-${questionId}`);
            const questionText = questionElement?.innerText || '';
            
            const prompt = customPromptText || '请分析这道题，给出答案和解析';
            
            const response = await axios.post(`${API_BASE}/api/ai/ask`, {
                subject: 'chinese',
                question: `${prompt}\n\n题目：${questionText}`,
                model: 'qwen2.5:7b'
            });
            
            if (response.data.success) {
                setAnalysisResult(response.data.answer);
                if (onAIAnalyzed) {
                    onAIAnalyzed(questionId, response.data.answer);
                }
            } else {
                setAnalysisResult('分析失败：' + response.data.error);
            }
        } catch (error) {
            setAnalysisResult('请求失败：' + error.message);
        }
        setAnalyzing(false);
        setShowCustomPrompt(false);
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }} ref={popupRef}>
            <button
                onClick={() => setShowCustomPrompt(!showCustomPrompt)}
                disabled={analyzing}
                style={{
                    padding: '4px 12px',
                    background: analyzing ? '#ccc' : '#1890ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: analyzing ? 'not-allowed' : 'pointer',
                    fontSize: '12px'
                }}
            >
                {analyzing ? '分析中...' : '🤖 AI分析'}
            </button>
            
            {showCustomPrompt && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '12px',
                    width: '280px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                    <div style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>
                        自定义分析提示
                    </div>
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="输入分析要求，如：判断对错并给出理由"
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '6px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => analyzeWithAI(customPrompt)}
                            style={{
                                padding: '4px 12px',
                                background: '#52c41a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                        >
                            开始分析
                        </button>
                        <button
                            onClick={() => setShowCustomPrompt(false)}
                            style={{
                                padding: '4px 12px',
                                background: '#f0f0f0',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}
            
            {analysisResult && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: '8px',
                    padding: '12px',
                    width: '300px',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflow: 'auto',
                    fontSize: '12px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>🤖 AI分析结果</div>
                    <div>{analysisResult}</div>
                    <button
                        onClick={() => setAnalysisResult(null)}
                        style={{
                            marginTop: '8px',
                            padding: '2px 8px',
                            background: 'transparent',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '10px'
                        }}
                    >
                        关闭
                    </button>
                </div>
            )}
        </div>
    );
};

export default AIAssistantToolbar;