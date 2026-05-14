import { useState, useEffect } from 'react';
import axios from 'axios';

function Listening() {
    const [listeningList, setListeningList] = useState([]);
    const [selectedListening, setSelectedListening] = useState(null);
    const [loading, setLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState('');
    const [pdfUrl, setPdfUrl] = useState('');

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

    const openListening = (item) => {
        setSelectedListening(item);
        if (item.audioFile) {
            setAudioUrl(`http://localhost:3001/api/exams/listening/audio/${encodeURIComponent(item.id)}/${encodeURIComponent(item.audioFile)}`);
        }
        if (item.pdfFile) {
            setPdfUrl(`http://localhost:3001/api/exams/listening/pdf/${encodeURIComponent(item.id)}/${encodeURIComponent(item.pdfFile)}`);
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
                        {listeningList.map((item, index) => (
                            <div
                                key={item.id}
                                onClick={() => openListening(item)}
                                style={{
                                    padding: '12px',
                                    margin: '8px 0',
                                    background: selectedListening?.id === item.id ? '#e6f7ff' : 'transparent',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    border: selectedListening?.id === item.id ? '1px solid #91d5ff' : '1px solid #e8e8e8',
                                    transition: 'all 0.2s',
                                    textAlign: 'left'  // 添加左对齐
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '24px' }}>🎧</span>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.name}</div>
                                        <div style={{ fontSize: '11px', color: '#999' }}>
                                            {item.hasAudio ? '音频' : ''} {item.hasPdf ? ' | 题目+答案' : ''}
                                        </div>
                                    </div>
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
                            包含听力音频 + 题目 + 原文 + 答案
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
                            <h2 style={{ margin: 0 }}>{selectedListening.name}</h2>
                            {pdfUrl && (
                                <a
                                    href={pdfUrl}
                                    download
                                    style={{
                                        padding: '6px 16px',
                                        background: '#52c41a',
                                        color: 'white',
                                        textDecoration: 'none',
                                        borderRadius: '4px'
                                    }}
                                >
                                    📥 下载题目PDF
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
                        {pdfUrl && (
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
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Listening;