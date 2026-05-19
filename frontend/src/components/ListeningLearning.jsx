import { useState, useEffect } from 'react';
import axios from 'axios';
import ListeningPlayer from './ListeningPlayer';

function ListeningLearning() {
    const [listeningList, setListeningList] = useState([]);
    const [selectedListening, setSelectedListening] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    };

    const closeListening = () => {
        setSelectedListening(null);
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
            {/* 左侧目录 - 与知识点学习风格一致 */}
            <div style={{
                width: sidebarCollapsed ? '60px' : '320px',
                background: '#f5f5f5',
                borderRight: '1px solid #e8e8e8',
                overflow: 'auto',
                padding: sidebarCollapsed ? '16px 8px' : '16px',
                transition: 'width 0.3s ease',
                position: 'relative'
            }}>
                {!sidebarCollapsed ? (
                    <>
                        {/* 折叠按钮 */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                            <button
                                onClick={() => setSidebarCollapsed(true)}
                                style={{
                                    background: '#1890ff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    fontSize: '12px'
                                }}
                            >
                                ← 收起
                            </button>
                        </div>

                        {/* 标题区域 */}
                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, marginBottom: '8px' }}>🎧 英语听力训练</h3>
                            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                                上海春考听力专项训练
                            </p>
                        </div>

                        {/* 听力列表 */}
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px', color: '#666', textAlign: 'left' }}>
                                📖 听力列表
                            </div>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
                            ) : listeningList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '12px' }}>
                                    暂无听力资料
                                </div>
                            ) : (
                                listeningList.map((item) => (
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
                                            textAlign: 'left'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '20px' }}>🎧</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                                    {item.name}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                                                    {item.hasAudio ? '🎵 音频' : ''}
                                                    {item.hasTeacher && item.hasStudent ? ' | 📄 含教师版+学生版' : 
                                                     item.hasTeacher ? ' | 📄 教师版' : 
                                                     item.hasStudent ? ' | 📄 学生版' : ''}
                                                </div>
                                            </div>
                                            {item.hasAudio && <span style={{ fontSize: '12px', color: '#52c41a' }}>●</span>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    /* 折叠状态 - 与知识点学习一致 */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
                        <button
                            onClick={() => setSidebarCollapsed(false)}
                            style={{
                                background: '#1890ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                fontSize: '12px'
                            }}
                        >
                            →
                        </button>
                        <div style={{ fontSize: '20px' }}>🎧</div>
                        <div style={{ fontSize: '12px', color: '#666', writingMode: 'vertical-rl' }}>
                            听力训练
                        </div>
                    </div>
                )}
            </div>

            {/* 右侧内容 - 复用 TopicLearning 风格 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                {!selectedListening ? (
                    <div style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎧</div>
                        <div>从左侧选择一套听力训练</div>
                        <div style={{ fontSize: '14px', marginTop: '8px' }}>
                            包含听力音频 + 题目 + 原文 + 答案
                        </div>
                        <div style={{ fontSize: '12px', color: '#bbb', marginTop: '8px' }}>
                            可选择教师版（含答案）或学生版（无答案）
                        </div>
                    </div>
                ) : (
                    <ListeningPlayer
                        listening={selectedListening}
                        onClose={closeListening}
                    />
                )}
            </div>
        </div>
    );
}

export default ListeningLearning;