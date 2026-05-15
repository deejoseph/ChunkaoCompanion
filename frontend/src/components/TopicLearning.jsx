import { useState, useEffect } from 'react';
import axios from 'axios';

function TopicLearning({ topic, subject, version, onClose, onRefreshProgress, onUpdateStatus }) {
    const [isTeacherMode, setIsTeacherMode] = useState(true);
    const [isCompleted, setIsCompleted] = useState(false);
    const [score, setScore] = useState(null);
    const [showOcrUpload, setShowOcrUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [ocrResult, setOcrResult] = useState(null);
    const [showFormulaInput, setShowFormulaInput] = useState(false);
    
    // 从localStorage读取学习状态
    useEffect(() => {
        const storageKey = `topic_${subject}_${topic.name}_status`;
        const status = localStorage.getItem(storageKey);
        console.log('读取状态:', storageKey, status);  // 添加日志
        if (status) {
            const parsed = JSON.parse(status);
            setIsCompleted(parsed.completed || false);
            setScore(parsed.score);
        } else {
            setIsCompleted(false);
            setScore(null);
        }
    }, [topic.name, subject]);  // 确保依赖正确

    // 获取当前要显示的PDF路径
    const getPdfUrl = () => {
        const filename = isTeacherMode ? topic.teacherFile : topic.studentFile;
        if (!filename) return null;
        return `http://localhost:3001/api/docs/pdf/${subject}/${version}/${encodeURIComponent(filename)}`;
    };

    // 标记学习完成
    const markCompleted = () => {
        const status = {
            completed: true,
            score: score,
            completedAt: new Date().toISOString()
        };
        // 使用完整的 topic.name（包含所有后缀）
        const storageKey = `topic_${subject}_${topic.name}_status`;
        console.log('保存状态:', storageKey, status);
        localStorage.setItem(storageKey, JSON.stringify(status));
        setIsCompleted(true);

        if (onUpdateStatus) {
            onUpdateStatus(topic.name, true, score);
        }

        if (onRefreshProgress) {
            onRefreshProgress();
        }

        alert('已完成学习！可以开始学生版测验了');
    };

    const handleOcrUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);
        formData.append('topicId', topic.id);

        try {
            const response = await axios.post('http://localhost:3001/api/ocr/recognize', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const latex = response.data.latex;
                setOcrResult(latex);

                // TODO: 这里需要计算实际成绩，目前使用模拟分数
                const mockScore = Math.floor(Math.random() * 30) + 70; // 70-100分

                // 保存成绩到 localStorage
                const storageKey = `topic_${subject}_${topic.id}_status`;
                const existingStatus = localStorage.getItem(storageKey);
                const status = existingStatus ? JSON.parse(existingStatus) : { completed: false };
                status.score = mockScore;
                status.lastOcrResult = latex;
                status.lastOcrTime = new Date().toISOString();
                localStorage.setItem(storageKey, JSON.stringify(status));

                setScore(mockScore);
                alert(`识别成功！公式: ${latex}\n成绩: ${mockScore}分`);

                // 通知父组件更新
                if (onUpdateStatus) {
                    onUpdateStatus(topic.id, false, mockScore);
                }
            } else {
                alert('识别失败: ' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('OCR识别失败:', error);
            alert('识别失败，请重试');
        } finally {
            setUploading(false);
            setShowOcrUpload(false);
        }
    };
    
    const sendToAIAssistant = () => {
        if (ocrResult) {
            const event = new CustomEvent('sendToAI', { detail: { text: ocrResult } });
            window.dispatchEvent(event);
            alert('已发送到AI助教，请点击右下角AI助教查看');
        }
    };

    const pdfUrl = getPdfUrl();

    return (
        <div style={{ textAlign: 'left', padding: '0 20px' }}>
            {/* 标题栏 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '10px',
                borderBottom: '2px solid #eee',
                flexWrap: 'wrap',
                gap: '10px'
            }}>
                <h2 style={{ margin: 0, fontSize: '20px', lineHeight: '1.3' }}>{topic.name}</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {score !== null && (
                        <span style={{
                            padding: '4px 12px',
                            background: score >= 80 ? '#f6ffed' : '#fff7e6',
                            border: `1px solid ${score >= 80 ? '#b7eb8f' : '#ffc53d'}`,
                            borderRadius: '20px',
                            fontSize: '14px'
                        }}>
                            📊 上次成绩: {score}分
                        </span>
                    )}
                    
                    {/* 修改后的按钮：始终显示，已完成时变灰不可点击 */}
                    {isTeacherMode && (
                        <button
                            onClick={markCompleted}
                            disabled={isCompleted}
                            style={{
                                padding: '6px 16px',
                                background: isCompleted ? '#ccc' : '#52c41a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isCompleted ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isCompleted ? '✅ 已完成' : '✅ 完成学习'}
                        </button>
                    )}
                </div>
            </div>

            {/* 模式切换 + 上传答题卡按钮 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setIsTeacherMode(true)}
                    style={{
                        padding: '8px 20px',
                        background: isTeacherMode ? '#1890ff' : '#f0f0f0',
                        color: isTeacherMode ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    📖 教师版（带答案）
                </button>
                <button
                    onClick={() => setIsTeacherMode(false)}
                    style={{
                        padding: '8px 20px',
                        background: !isTeacherMode ? '#1890ff' : '#f0f0f0',
                        color: !isTeacherMode ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    📝 学生版（测验）
                </button>
                
                {/* 上传答题卡按钮 - 只在学生版显示 */}
                {!isTeacherMode && (
                    <>
                        <button
                            onClick={() => setShowOcrUpload(!showOcrUpload)}
                            style={{
                                padding: '8px 20px',
                                background: '#fa8c16',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            📸 上传答题卡
                        </button>
                        
                        <button
                            onClick={() => setShowFormulaInput(!showFormulaInput)}
                            style={{
                                padding: '8px 20px',
                                background: showFormulaInput ? '#52c41a' : '#f0f0f0',
                                color: showFormulaInput ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            📐 公式输入
                        </button>
                    </>
                )}
            </div>

            {/* 公式输入区域 */}
            {showFormulaInput && (
                <div style={{
                    marginBottom: '20px',
                    padding: '20px',
                    background: '#f0f7ff',
                    borderRadius: '8px',
                    border: '1px solid #91d5ff'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>📐 公式输入</div>
                    <textarea
                        id="formulaInput"
                        placeholder="请输入LaTeX公式，例如：\frac{1}{2} 或 \sqrt{x^2 + y^2}"
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '14px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                            fontFamily: 'monospace'
                        }}
                    />
                    <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => {
                                const input = document.getElementById('formulaInput');
                                const latex = input.value.trim();
                                if (latex) {
                                    const event = new CustomEvent('sendToAI', { detail: { text: latex } });
                                    window.dispatchEvent(event);
                                    alert('已发送到AI助教，请点击右下角AI助教提问');
                                    input.value = '';
                                    setShowFormulaInput(false);
                                } else {
                                    alert('请输入公式');
                                }
                            }}
                            style={{
                                padding: '6px 16px',
                                background: '#1890ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            📤 发送到AI助教
                        </button>
                        <button
                            onClick={() => setShowFormulaInput(false)}
                            style={{
                                padding: '6px 16px',
                                background: '#f0f0f0',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            取消
                        </button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                        💡 提示：常用公式写法：分数 \frac{分子}{分母}，根号 \sqrt{表达式}，积分 \int_{a}^{b}
                    </div>
                </div>
            )}

            {/* OCR识别结果区域 */}
            {ocrResult && (
                <div style={{
                    marginBottom: '20px',
                    padding: '15px',
                    background: '#f6ffed',
                    borderRadius: '8px',
                    border: '1px solid #b7eb8f',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <div>
                        <strong>识别结果：</strong>
                        <code style={{ background: '#f0f0f0', padding: '4px 8px', borderRadius: '4px', marginLeft: '8px' }}>
                            {ocrResult}
                        </code>
                    </div>
                    <button
                        onClick={sendToAIAssistant}
                        style={{
                            padding: '4px 12px',
                            background: '#1890ff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        发送到AI助教
                    </button>
                </div>
            )}

            {/* 温馨提示 */}
            <div style={{
                background: '#fff7e6',
                border: '1px solid #ffc53d',
                borderRadius: '8px',
                padding: '10px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <span style={{ color: '#666', fontSize: '13px' }}>
                    题目中可能存在OCR识别错误，建议对照教材核对。学生版完成后可上传答题卡获取批改。
                </span>
            </div>

            {/* OCR上传区域 */}
            {showOcrUpload && (
                <div style={{
                    marginBottom: '20px',
                    padding: '20px',
                    background: '#fff7e6',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '1px solid #ffc53d'
                }}>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleOcrUpload}
                        disabled={uploading}
                    />
                    {uploading && <div style={{ marginTop: '10px' }}>识别中...</div>}
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
                        拍照上传你的答卷，AI自动识别公式
                    </p>
                </div>
            )}

            {/* PDF展示区域 */}
            {pdfUrl ? (
                <div style={{
                    border: '1px solid #e8e8e8',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: '#fafafa'
                }}>
                    <iframe
                        src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                        style={{
                            width: '100%',
                            height: '70vh',
                            border: 'none'
                        }}
                        title={topic.name}
                    />
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                    PDF文件不存在，请先运行清理脚本生成PDF
                </div>
            )}

            {/* 返回按钮 */}
            <button
                onClick={onClose}
                style={{
                    marginTop: '20px',
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                ← 返回专题列表
            </button>
        </div>
    );
}

export default TopicLearning;