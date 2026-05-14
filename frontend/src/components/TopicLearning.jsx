import { useState, useEffect } from 'react';
import axios from 'axios';

function TopicLearning({ topic, subject, version, onClose, onRefreshProgress }) {
    const [isTeacherMode, setIsTeacherMode] = useState(true);
    const [isCompleted, setIsCompleted] = useState(false);
    const [score, setScore] = useState(null);
    const [showOcrUpload, setShowOcrUpload] = useState(false);
    const [uploading, setUploading] = useState(false);

    // 从localStorage读取学习状态
    useEffect(() => {
        const status = localStorage.getItem(`topic_${topic.id}_status`);
        if (status) {
            const parsed = JSON.parse(status);
            setIsCompleted(parsed.completed || false);
            setScore(parsed.score);
        }
    }, [topic]);

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
        localStorage.setItem(`topic_${topic.id}_status`, JSON.stringify(status));
        setIsCompleted(true);
        if (onRefreshProgress) onRefreshProgress();
        alert('已完成学习！可以开始学生版测验了');
    };

    // 处理OCR上传
    const handleOcrUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);
        formData.append('topicId', topic.id);

        try {
            // TODO: 实现OCR接口，目前模拟随机分数
            // 临时模拟成绩
            setTimeout(() => {
                const mockScore = Math.floor(Math.random() * 30) + 70; // 70-100分
                setScore(mockScore);
                
                const status = JSON.parse(localStorage.getItem(`topic_${topic.id}_status`) || '{}');
                status.score = mockScore;
                localStorage.setItem(`topic_${topic.id}_status`, JSON.stringify(status));
                
                alert(`成绩：${mockScore}分`);
                setShowOcrUpload(false);
                setUploading(false);
                if (onRefreshProgress) onRefreshProgress();
            }, 1500);
            
            // 正式使用时替换为真实API：
            // const response = await axios.post('http://localhost:3001/api/ocr/grade', formData);
            // setScore(response.data.score);
        } catch (error) {
            console.error('OCR识别失败:', error);
            alert('识别失败，请重试');
            setUploading(false);
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
                    {!isCompleted && isTeacherMode && (
                        <button
                            onClick={markCompleted}
                            style={{
                                padding: '6px 16px',
                                background: '#52c41a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            ✅ 完成学习
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
                )}
            </div>

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
                        拍照上传你的答卷，AI自动批改并记录成绩
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