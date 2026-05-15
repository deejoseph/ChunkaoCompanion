import { useState, useEffect } from 'react';
import axios from 'axios';
import FloatingAIAssistant from './FloatingAIAssistant';
import TopicLearning from './TopicLearning';

function KnowledgeLearning() {
    const [selectedSubject, setSelectedSubject] = useState('chinese');
    const [selectedVersion, setSelectedVersion] = useState('2026');
    const [topics, setTopics] = useState([]);
    const [selectedTopicForLearning, setSelectedTopicForLearning] = useState(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const subjects = {
        chinese: { name: '语文', color: '#52c41a', dir: 'chinese' },
        math: { name: '数学', color: '#1890ff', dir: 'math' },
        english: { name: '英语', color: '#fa8c16', dir: 'english' }
    };

    useEffect(() => {
        loadTopics();
    }, [selectedSubject, selectedVersion]);

    useEffect(() => {
        calculateProgress();
    }, [topics]);
    
    // 更新单个专题的状态（无需重新加载整个列表）
    const updateTopicStatus = (topicName, isCompleted, score) => {
        setTopics(prevTopics => 
            prevTopics.map(topic => 
                topic.name === topicName 
                    ? { ...topic, isCompleted, score }
                    : topic
            )
        );
    };

    const calculateProgress = () => {
        let completed = 0;
        topics.forEach(topic => {
            const storageKey = `topic_${selectedSubject}_${topic.name}_status`;
            console.log('读取 key:', storageKey);
            const status = localStorage.getItem(storageKey);
            if (status) {
                try {
                    const parsed = JSON.parse(status);
                    if (parsed.completed) completed++;
                } catch (e) {}
            }
        });
        setProgress(topics.length > 0 ? Math.round((completed / topics.length) * 100) : 0);
    };

    const loadTopics = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`http://localhost:3001/api/docs/topics/${selectedSubject}/${selectedVersion}`);
            console.log('API响应:', response.data);

            if (response.data.success && response.data.topics) {
                setTopics(response.data.topics);

                // 保存该学科该版本的总专题数
                const totalKey = `total_${selectedSubject}_${selectedVersion}`;
                localStorage.setItem(totalKey, response.data.topics.length);
                console.log(`保存总数: ${totalKey} = ${response.data.topics.length}`);
            } else {
                console.error('返回数据格式错误:', response.data);
                setTopics([]);
            }
        } catch (error) {
            console.error('加载专题列表失败:', error);
            setTopics([]);
        }
        setLoading(false);
    };

    const openTopicLearning = (topic) => {
        setSelectedTopicForLearning(topic);
    };

    const closeTopicLearning = () => {
        setSelectedTopicForLearning(null);
        loadTopics(); // 刷新进度
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
            {/* 左侧目录 */}
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

                        {/* 进度条 */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>📊 学习进度</span>
                                <span>{progress}%</span>
                            </div>
                            <div style={{ background: '#e8e8e8', borderRadius: '4px', height: '8px' }}>
                                <div style={{
                                    width: `${progress}%`,
                                    background: progress === 100 ? '#52c41a' : '#fa8c16',
                                    borderRadius: '4px',
                                    height: '100%',
                                    transition: 'width 0.3s'
                                }} />
                            </div>
                        </div>

                        {/* 学科切换 */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            {Object.entries(subjects).map(([key, val]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setSelectedSubject(key);
                                        setSelectedTopicForLearning(null);
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

                        {/* 版本切换 */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button
                                onClick={() => {
                                    setSelectedVersion('2026');
                                    setSelectedTopicForLearning(null);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '6px',
                                    background: selectedVersion === '2026' ? '#1890ff' : '#fff',
                                    color: selectedVersion === '2026' ? '#fff' : '#333',
                                    border: '1px solid #1890ff',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                2026版
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedVersion('2025');
                                    setSelectedTopicForLearning(null);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '6px',
                                    background: selectedVersion === '2025' ? '#1890ff' : '#fff',
                                    color: selectedVersion === '2025' ? '#fff' : '#333',
                                    border: '1px solid #1890ff',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                2025版
                            </button>
                        </div>

                        {/* 专题列表 */}
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px', color: '#666', textAlign: 'left' }}>
                                📖 专题列表
                            </div>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
                            ) : topics.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '12px' }}>
                                    暂无专题
                                </div>
                            ) : (
                            topics.map(topic => {
                                // 使用 topic.name（中文名称）作为 key
                                const storageKey = `topic_${selectedSubject}_${topic.name}_status`;
                                const status = localStorage.getItem(storageKey);
                                let isCompleted = false;
                                let score = null;
                                if (status) {
                                    try {
                                        const parsed = JSON.parse(status);
                                        isCompleted = parsed.completed;
                                        score = parsed.score;
                                    } catch (e) {}
                                }

                                return (
                                    <div
                                        key={topic.id}
                                        onClick={() => openTopicLearning(topic)}
                                        style={{
                                            padding: '8px 8px 8px 24px',
                                            margin: '4px 0',
                                            background: selectedTopicForLearning?.id === topic.id ? '#e6f7ff' : 'transparent',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            textAlign: 'left',
                                            opacity: isCompleted ? 0.75 : 1
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, textAlign: 'left' }}>
                                            {isCompleted ? '✅' : '📖'}
                                            <span style={{ 
                                                fontSize: '14px', 
                                                flex: 1, 
                                                textAlign: 'left',
                                                textDecoration: isCompleted ? 'line-through' : 'none',
                                                color: isCompleted ? '#999' : '#333'
                                            }}>
                                                {topic.name}
                                            </span>
                                        </div>
                                        {score !== null && (
                                            <span style={{
                                                fontSize: '12px',
                                                color: score >= 80 ? '#52c41a' : score >= 60 ? '#fa8c16' : '#f5222d',
                                                textAlign: 'right'
                                            }}>
                                                {score}分
                                            </span>
                                        )}
                                    </div>
                                );
                            })
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
                        {Object.entries(subjects).map(([key, val]) => (
                            <button
                                key={key}
                                onClick={() => {
                                    setSelectedSubject(key);
                                    setSelectedTopicForLearning(null);
                                }}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    background: selectedSubject === key ? val.color : '#fff',
                                    color: selectedSubject === key ? '#fff' : '#333',
                                    border: `1px solid ${val.color}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '20px'
                                }}
                                title={val.name}
                            >
                                {val.name.charAt(0)}
                            </button>
                        ))}
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '20px' }}>
                            {progress}%
                        </div>
                    </div>
                )}
            </div>

            {/* 右侧内容 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                {!selectedTopicForLearning ? (
                    <div style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
                        <div>从左侧选择一个专题开始学习</div>
                        <div style={{ fontSize: '14px', marginTop: '8px' }}>
                            每个专题包含：教师版（学习）+ 学生版（测验）
                        </div>
                    </div>
                ) : (
                    <TopicLearning
                        topic={selectedTopicForLearning}
                        subject={selectedSubject}
                        version={selectedVersion}
                        onClose={closeTopicLearning}
                        onRefreshProgress={() => loadTopics()} 
                        onUpdateStatus={updateTopicStatus}  // 添加这行
                        // 刷新列表
                    />
                )}
            </div>

            {/* 悬浮AI助教 */}
            <FloatingAIAssistant 
                currentTopic={selectedTopicForLearning?.name} 
                currentSubject={selectedSubject}
            />
        </div>
    );
}

export default KnowledgeLearning;