import { useState, useEffect } from 'react';
import axios from 'axios';

function Listening() {
    const [listeningList, setListeningList] = useState([]);
    const [selectedListening, setSelectedListening] = useState(null);
    const [loading, setLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState('');
    const [pdfUrl, setPdfUrl] = useState('');
    const [pdfType, setPdfType] = useState('student'); // 'student' 或 'teacher'

    // 加载听力列表
    useEffect(() => {
        loadListeningList();
    }, []);

    const loadListeningList = async () => {
        setLoading(true);
        try {
            const response = await axios.get('http://localhost:3001/api/listening/list');
            if (response.data.success) {
                setListeningList(response.data.list);
            }
        } catch (error) {
            console.error('加载听力列表失败:', error);
        }
        setLoading(false);
    };

    const openListening = (item, type = 'student') => {
        setSelectedListening(item);
        setPdfType(type);

        if (item.audioFile) {
            // 直接传递原始文件名，不要编码
            setAudioUrl(`http://localhost:3001/api/listening/audio/${item.index}/${item.audioFile}`);
        }

        const pdfFile = type === 'teacher' ? item.teacherFile : item.studentFile;
        if (pdfFile) {
            // 直接传递原始文件名，不要编码
            setPdfUrl(`http://localhost:3001/api/listening/pdf/${item.index}/${type}/${pdfFile}`);
        } else {
            setPdfUrl('');
        }
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
            {/* 左侧目录 */}
            <div style={{
                width: '320px',
                background: '#f5f5f5',
                borderRight: '1px solid #e8e8e8',
                overflow: 'auto',
                padding: '16px'
            }}>
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, marginBottom: '8px' }}>🎧 英语听力训练</h3>
                    <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                        上海春考听力专项训练
                    </p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
                ) : (
                    <div>
                        {listeningList.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    marginBottom: '16px',
                                    border: selectedListening?.id === item.id ? '1px solid #1890ff' : '1px solid #e8e8e8',
                                    borderRadius: '8px',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* 标题 */}
                                <div style={{
                                    padding: '12px',
                                    background: selectedListening?.id === item.id ? '#e6f7ff' : '#fafafa',
                                    fontWeight: 'bold',
                                    fontSize: '14px'
                                }}>
                                    {item.name}
                                </div>
                                
                                {/* 两个版本按钮 */}
                                <div style={{ display: 'flex', borderTop: '1px solid #e8e8e8' }}>
                                    <button
                                        onClick={() => openListening(item, 'student')}
                                        style={{
                                            flex: 1,
                                            padding: '10px',
                                            background: selectedListening?.id === item.id && pdfType === 'student' ? '#52c41a' : 'white',
                                            color: selectedListening?.id === item.id && pdfType === 'student' ? 'white' : '#333',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        📖 学生版
                                        {item.hasStudent && <span style={{ fontSize: '10px', marginLeft: '4px' }}>(无答案)</span>}
                                    </button>
                                    <button
                                        onClick={() => openListening(item, 'teacher')}
                                        style={{
                                            flex: 1,
                                            padding: '10px',
                                            background: selectedListening?.id === item.id && pdfType === 'teacher' ? '#fa8c16' : 'white',
                                            color: selectedListening?.id === item.id && pdfType === 'teacher' ? 'white' : '#333',
                                            borderLeft: '1px solid #e8e8e8',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        👨‍🏫 教师版
                                        {item.hasTeacher && <span style={{ fontSize: '10px', marginLeft: '4px' }}>(含答案)</span>}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 右侧内容 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                {!selectedListening ? (
                    <div style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎧</div>
                        <div>从左侧选择一套听力训练</div>
                        <div style={{ fontSize: '14px', marginTop: '8px' }}>
                            可选择学生版（无答案）或教师版（含答案）
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            paddingBottom: '10px',
                            borderBottom: '2px solid #eee'
                        }}>
                            <h2 style={{ margin: 0 }}>
                                {selectedListening.name} 
                                <span style={{
                                    fontSize: '14px',
                                    marginLeft: '12px',
                                    padding: '4px 8px',
                                    background: pdfType === 'teacher' ? '#fa8c16' : '#52c41a',
                                    color: 'white',
                                    borderRadius: '4px'
                                }}>
                                    {pdfType === 'teacher' ? '教师版（含答案）' : '学生版（无答案）'}
                                </span>
                            </h2>
                            {pdfUrl && (
                                <a
                                    href={pdfUrl}
                                    download
                                    style={{
                                        padding: '6px 16px',
                                        background: '#1890ff',
                                        color: 'white',
                                        textDecoration: 'none',
                                        borderRadius: '4px'
                                    }}
                                >
                                    📥 下载PDF
                                </a>
                            )}
                        </div>

                        {/* 音频播放器 */}
                        {audioUrl && (
                            <div style={{
                                background: '#f0f7ff',
                                padding: '20px',
                                borderRadius: '8px',
                                marginBottom: '20px'
                            }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>🎵 听力音频</div>
                                <audio controls style={{ width: '100%' }}>
                                    <source src={audioUrl} type="audio/mpeg" />
                                    您的浏览器不支持音频播放
                                </audio>
                            </div>
                        )}

                        {/* PDF展示 */}
                        {pdfUrl ? (
                            <div style={{
                                border: '1px solid #e8e8e8',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: '#fafafa'
                            }}>
                                <iframe
                                    src={pdfUrl}
                                    style={{
                                        width: '100%',
                                        height: '65vh',
                                        border: 'none'
                                    }}
                                    title={selectedListening.name}
                                />
                            </div>
                        ) : (
                            <div style={{
                                textAlign: 'center',
                                padding: '60px',
                                color: '#999',
                                background: '#fafafa',
                                borderRadius: '8px'
                            }}>
                                📄 该版本PDF文件不存在
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Listening;