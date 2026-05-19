import { useState, useEffect } from 'react';

function ListeningPlayer({ listening, onClose }) {
    const [isTeacherMode, setIsTeacherMode] = useState(true);  // 改为 true，默认教师版
    const [audioUrl, setAudioUrl] = useState('');
    const [pdfUrl, setPdfUrl] = useState('');

    useEffect(() => {
        // 设置音频URL
        if (listening.audioFile) {
            setAudioUrl(`http://localhost:3001/api/listening/audio/${listening.index}/${encodeURIComponent(listening.audioFile)}`);
        }
        
        // 根据模式设置PDF URL
        updatePdfUrl(isTeacherMode);
    }, [listening]);

    const updatePdfUrl = (teacherMode) => {
        const pdfFile = teacherMode ? listening.teacherFile : listening.studentFile;
        if (pdfFile) {
            setPdfUrl(`http://localhost:3001/api/listening/pdf/${listening.index}/${teacherMode ? 'teacher' : 'student'}/${encodeURIComponent(pdfFile)}`);
        } else {
            setPdfUrl('');
        }
    };

    const handleModeChange = (teacherMode) => {
        setIsTeacherMode(teacherMode);
        updatePdfUrl(teacherMode);
    };

    return (
        <div style={{ textAlign: 'left', padding: '0 20px' }}>
            {/* 标题栏 - 与 TopicLearning 风格一致 */}
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
                <h2 style={{ margin: 0, fontSize: '20px', lineHeight: '1.3' }}>
                    🎧 {listening.name}
                </h2>
            </div>

            {/* 模式切换按钮 - 与 TopicLearning 风格一致（教师版在前） */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                    onClick={() => handleModeChange(true)}
                    style={{
                        padding: '8px 20px',
                        background: isTeacherMode ? '#1890ff' : '#f0f0f0',
                        color: isTeacherMode ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    👨‍🏫 教师版（含答案）
                </button>
                <button
                    onClick={() => handleModeChange(false)}
                    style={{
                        padding: '8px 20px',
                        background: !isTeacherMode ? '#1890ff' : '#f0f0f0',
                        color: !isTeacherMode ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    📖 学生版（无答案）
                </button>

                {pdfUrl && (
                    <a
                        href={pdfUrl}
                        download
                        style={{
                            padding: '6px 16px',
                            background: '#52c41a',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '4px',
                            fontSize: '13px'
                        }}
                    >
                        📥 下载PDF
                    </a>
                )}
            </div>

            {/* 温馨提示 - 与 TopicLearning 风格一致 */}
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
                <span style={{ fontSize: '20px' }}>💡</span>
                <span style={{ color: '#666', fontSize: '13px' }}>
                    {isTeacherMode ? 
                        '教师版包含听力原文和参考答案，适合老师备课或家长辅导。' : 
                        '学生版不包含答案，适合学生练习。建议先完成练习，再对照教师版核对答案。'}
                </span>
            </div>

            {/* 音频播放器 - 与 TopicLearning 的按钮区域风格一致 */}
            {audioUrl && (
                <div style={{
                    background: '#f0f7ff',
                    padding: '20px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '1px solid #91d5ff'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>🎵 听力音频</div>
                    <audio controls style={{ width: '100%' }}>
                        <source src={audioUrl} type="audio/mpeg" />
                        您的浏览器不支持音频播放
                    </audio>
                </div>
            )}

            {/* PDF展示区域 - 与 TopicLearning 风格一致 */}
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
                        title={listening.name}
                    />
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '50px', color: '#999', background: '#fafafa', borderRadius: '8px' }}>
                    📄 {isTeacherMode ? '教师版' : '学生版'}PDF文件不存在
                </div>
            )}

            {/* 返回按钮 - 与 TopicLearning 风格一致 */}
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
                ← 返回听力列表
            </button>
        </div>
    );
}

export default ListeningPlayer;