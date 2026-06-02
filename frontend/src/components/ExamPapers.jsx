import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';  // 新增

function ExamPapers() {
    const [selectedSubject, setSelectedSubject] = useState('chinese');
    const [selectedYear, setSelectedYear] = useState('2026');
    const [papers, setPapers] = useState([]);
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [loading, setLoading] = useState(false);
    const [paperUrl, setPaperUrl] = useState('');
    const [hasListening, setHasListening] = useState(false);
    const [listeningAudioUrl, setListeningAudioUrl] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const subjects = {
        chinese: { name: '语文', color: '#52c41a', dir: 'chinese' },
        math: { name: '数学', color: '#1890ff', dir: 'math' },
        english: { name: '英语', color: '#fa8c16', dir: 'english' }
    };

    const years = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];

    useEffect(() => {
        loadPapers();
    }, [selectedSubject, selectedYear]);

    useEffect(() => {
        if (selectedSubject === 'english' && selectedPaper) {
            checkListening();
        } else {
            setHasListening(false);
        }
    }, [selectedSubject, selectedPaper, selectedYear]);

    const loadPapers = async () => {
        setLoading(true);
        try {
            const [examRes, mockRes] = await Promise.all([
                axios.get(`${API_BASE}/api/exams/papers/${selectedSubject}/${selectedYear}`),
                axios.get(`${API_BASE}/api/exams/mock/${selectedSubject}/${selectedYear}`)
            ]);

            let allPapers = [];

            if (examRes.data.success && examRes.data.papers) {
                allPapers = [...allPapers, ...examRes.data.papers.map(p => ({ ...p, type: 'exam' }))];
            }
            if (mockRes.data.success && mockRes.data.papers) {
                allPapers = [...allPapers, ...mockRes.data.papers.map(p => ({ ...p, type: 'simulation' }))];
            }

            setPapers(allPapers);
            console.log(`加载: 真题 ${examRes.data?.papers?.length || 0}, 模拟卷 ${mockRes.data?.papers?.length || 0}`);
        } catch (error) {
            console.error('加载失败:', error);
        }
        setLoading(false);
    };
    
    const checkListening = async () => {
        console.log('checkListening 被调用, 年份:', selectedYear);
        try {
            const response = await axios.get(`${API_BASE}/api/exams/listening/check/${selectedYear}`);
            if (response.data.hasListening && response.data.audioUrl) {
                setHasListening(true);
                setListeningAudioUrl(`${API_BASE}${response.data.audioUrl}`);
            } else {
                setHasListening(false);
            }
        } catch (error) {
            console.error('听力检测失败:', error);
            setHasListening(false);
        }
    };

    const openPaper = (paper) => {
        setSelectedPaper(paper);
        const encodedFilename = encodeURIComponent(paper.filename);
        let url;
        if (paper.type === 'exam') {
            url = `${API_BASE}/api/exams/pdf/${selectedSubject}/${selectedYear}/exam/${encodedFilename}`;
        } else {
            url = `${API_BASE}/api/exams/pdf/${selectedSubject}/${selectedYear}/mock/${encodedFilename}`;
        }
        setPaperUrl(url);
    };

    const examPapers = papers.filter(p => p.type === 'exam');
    const simulationPapers = papers.filter(p => p.type === 'simulation');

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
            {/* 左侧目录 - 支持收起/展开 */}
            <div style={{
                width: sidebarCollapsed ? '60px' : '280px',
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

                        {/* 标题 */}
                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, marginBottom: '8px' }}>📝 上海春考真题</h3>
                            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                                历年真题 + 模拟试卷
                            </p>
                        </div>

                        {/* 学科切换 */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                            {Object.entries(subjects).map(([key, val]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setSelectedSubject(key);
                                        setSelectedPaper(null);
                                        setHasListening(false);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        background: selectedSubject === key ? val.color : '#fff',
                                        color: selectedSubject === key ? '#fff' : '#333',
                                        border: `1px solid ${val.color}`,
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {val.name}
                                </button>
                            ))}
                        </div>

                        {/* 年份切换 */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                                年份筛选
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {years.map(year => (
                                    <button
                                        key={year}
                                        onClick={() => {
                                            setSelectedYear(year);
                                            setSelectedPaper(null);
                                            setHasListening(false);
                                        }}
                                        style={{
                                            padding: '4px 10px',
                                            background: selectedYear === year ? '#1890ff' : '#fff',
                                            color: selectedYear === year ? '#fff' : '#333',
                                            border: `1px solid ${selectedYear === year ? '#1890ff' : '#ddd'}`,
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        {year}年
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 真题列表 */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                                📖 真题试卷
                            </div>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
                            ) : examPapers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '12px' }}>
                                    暂无{selectedYear}年真题
                                </div>
                            ) : (
                                examPapers.map(paper => (
                                    <div
                                        key={paper.id}
                                        onClick={() => openPaper(paper)}
                                        style={{
                                            padding: '10px 12px',
                                            margin: '4px 0',
                                            background: selectedPaper?.id === paper.id ? '#e6f7ff' : 'transparent',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'background 0.2s',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <span>📄</span>
                                        <span style={{ fontSize: '13px', textAlign: 'left' }}>{paper.name}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* 模拟卷列表 */}
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                                📝 模拟试卷
                            </div>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
                            ) : simulationPapers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '12px' }}>
                                    暂无{selectedYear}年模拟卷
                                </div>
                            ) : (
                                simulationPapers.map(paper => (
                                    <div
                                        key={paper.id}
                                        onClick={() => openPaper(paper)}
                                        style={{
                                            padding: '10px 12px',
                                            margin: '4px 0',
                                            background: selectedPaper?.id === paper.id ? '#e6f7ff' : 'transparent',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'background 0.2s',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <span>📋</span>
                                        <span style={{ fontSize: '13px', textAlign: 'left' }}>{paper.name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    /* 折叠状态 */
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
                        <div style={{ fontSize: '20px' }}>📝</div>
                        <div style={{ fontSize: '12px', color: '#666', writingMode: 'vertical-rl' }}>
                            真题
                        </div>
                    </div>
                )}
            </div>

            {/* 右侧内容 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                {!selectedPaper ? (
                    <div style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
                        <div>从左侧选择一份真题或模拟卷</div>
                        <div style={{ fontSize: '14px', marginTop: '8px' }}>
                            包含2017-2026年上海春考真题 + 模拟试卷
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
                            <h2 style={{ margin: 0 }}>{selectedPaper.name}</h2>
                            <a
                                href={paperUrl}
                                download
                                style={{
                                    padding: '6px 16px',
                                    background: '#52c41a',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: '4px'
                                }}
                            >
                                📥 下载PDF
                            </a>
                        </div>

                        {/* 听力播放器（仅英语且有听力时显示） */}
                        {hasListening && listeningAudioUrl && (
                            <div style={{
                                background: '#f0f7ff',
                                padding: '15px 20px',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                border: '1px solid #91d5ff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                flexWrap: 'wrap'
                            }}>
                                <span style={{ fontSize: '24px' }}>🎧</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{selectedYear}年听力音频</div>
                                    <audio controls style={{ width: '100%', maxWidth: '400px' }}>
                                        <source src={listeningAudioUrl} type="audio/mpeg" />
                                        您的浏览器不支持音频播放
                                    </audio>
                                </div>
                                <a
                                    href={listeningAudioUrl}
                                    download
                                    style={{
                                        padding: '6px 16px',
                                        background: '#1890ff',
                                        color: 'white',
                                        textDecoration: 'none',
                                        borderRadius: '4px',
                                        fontSize: '13px'
                                    }}
                                >
                                    📥 下载音频
                                </a>
                            </div>
                        )}

                        {/* PDF展示 */}
                        <div style={{
                            border: '1px solid #e8e8e8',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: '#fafafa'
                        }}>
                            <iframe
                                src={paperUrl}
                                style={{
                                    width: '100%',
                                    height: '84vh',
                                    border: 'none'
                                }}
                                title={selectedPaper.name}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExamPapers;
