import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

function InternationalCourses() {
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [courseStructure, setCourseStructure] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [subtitleUrl, setSubtitleUrl] = useState('');
    const [coursePdfUrl, setCoursePdfUrl] = useState('');
    const [expandedFolders, setExpandedFolders] = useState({});
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE}/api/international/courses`);
            console.log('课程列表响应:', response.data);
            if (response.data.success) {
                setCourses(response.data.courses);
            }
        } catch (error) {
            console.error('加载课程列表失败:', error);
        }
        setLoading(false);
    };

    const getCoursePdfUrl = (courseId) => {
        if (courseId.includes('TOEFL')) {
            return `${API_BASE}/api/international/root-file/加州大学托福准备专项课程.pdf`;
        }
        if (courseId.includes('IELTS')) {
            return `${API_BASE}/api/international/root-file/加州大学雅思准备专项课程.pdf`;
        }
        return null;
    };

    const selectCourse = async (course) => {
        console.log('选择课程:', course);
        setSelectedCourse(course);
        // 清空视频状态
        setSelectedVideo(null);
        setVideoUrl('');
        setSubtitleUrl('');
        
        const pdfUrl = getCoursePdfUrl(course.id);
        console.log('讲义URL:', pdfUrl);
        if (pdfUrl) {
            try {
                const testRes = await fetch(pdfUrl);
                if (testRes.ok) {
                    setCoursePdfUrl(pdfUrl);
                } else {
                    setCoursePdfUrl('');
                }
            } catch (err) {
                setCoursePdfUrl('');
            }
        } else {
            setCoursePdfUrl('');
        }
        
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE}/api/international/courses/${course.id}/structure`);
            if (response.data.success) {
                setCourseStructure(response.data.structure);
                const initialExpanded = {};
                response.data.structure.forEach(item => {
                    if (item.type === 'folder') {
                        initialExpanded[item.path] = true;
                    }
                });
                setExpandedFolders(initialExpanded);
            }
        } catch (error) {
            console.error('加载课程结构失败:', error);
        }
        setLoading(false);
    };

    const toggleFolder = (path) => {
        setExpandedFolders(prev => ({
            ...prev,
            [path]: !prev[path]
        }));
    };

    // 选择视频 - 添加 key 强制重新渲染
    const selectVideo = (courseId, filePath, fileName) => {
        console.log('选择视频:', filePath);
        
        // 清空旧视频状态
        setVideoUrl('');
        setSubtitleUrl('');
        setSelectedVideo(null);
        
        // 使用 setTimeout 确保状态清空后再设置新视频
        setTimeout(() => {
            const url = `${API_BASE}/api/international/file/${courseId}/${encodeURIComponent(filePath)}`;
            const subtitlePath = filePath.replace(/\.(mp4)$/i, '.srt');
            const subUrl = `${API_BASE}/api/international/subtitle/${courseId}/${encodeURIComponent(subtitlePath)}`;
            
            setSelectedVideo({ path: filePath, name: fileName });
            setVideoUrl(url);
            setSubtitleUrl(subUrl);
            
            console.log('视频URL:', url);
            console.log('VTT字幕URL:', subUrl);
        }, 50);
    };

    const downloadVideo = () => {
        if (!selectedVideo || !selectedCourse) return;
        const url = `${API_BASE}/api/international/file/${selectedCourse.id}/${encodeURIComponent(selectedVideo.path)}`;
        window.open(url, '_blank');
    };

    const filterVideoOnly = (items) => {
        if (!items) return [];
        return items.filter(item => {
            if (item.type === 'folder') return true;
            return item.fileType === 'video';
        }).map(item => {
            if (item.type === 'folder' && item.children) {
                return { ...item, children: filterVideoOnly(item.children) };
            }
            return item;
        });
    };

    const renderTree = (items, courseId, level = 0) => {
        if (!items) return null;
        const videoOnlyItems = filterVideoOnly(items);
        
        return videoOnlyItems.map((item, idx) => {
            const indent = level * 16;
            
            if (item.type === 'folder') {
                const isExpanded = expandedFolders[item.path];
                return (
                    <div key={item.path} style={{ marginLeft: 0 }}>
                        <div
                            onClick={() => toggleFolder(item.path)}
                            style={{
                                padding: '6px 8px',
                                paddingLeft: `${8 + indent}px`,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                borderRadius: '4px',
                                backgroundColor: 'transparent'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <span style={{ fontSize: '14px' }}>{isExpanded ? '📂' : '📁'}</span>
                            <span style={{ fontSize: '13px', flex: 1, textAlign: 'left' }}>{item.name}</span>
                            <span style={{ fontSize: '11px', color: '#999' }}>{isExpanded ? '▼' : '▶'}</span>
                        </div>
                        {isExpanded && item.children && (
                            <div>
                                {renderTree(item.children, courseId, level + 1)}
                            </div>
                        )}
                    </div>
                );
            } else if (item.fileType === 'video') {
                const isSelected = selectedVideo?.path === item.path;
                return (
                    <div
                        key={item.path}
                        onClick={() => selectVideo(courseId, item.path, item.name)}
                        style={{
                            padding: '6px 8px',
                            paddingLeft: `${24 + indent}px`,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderRadius: '4px',
                            backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                            fontSize: '12px'
                        }}
                        onMouseEnter={(e) => {
                            if (!isSelected) {
                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isSelected) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }
                        }}
                    >
                        <span>🎬</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                            {item.name}
                        </span>
                        <span style={{ fontSize: '10px', color: '#52c41a' }}>▶</span>
                    </div>
                );
            }
            return null;
        });
    };

    // 视频组件 key - 切换视频时强制重新渲染
    const videoKey = videoUrl ? `video-${Date.now()}` : 'video-empty';

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
            {/* 左侧课程选择 + 目录树 */}
            <div style={{
                width: sidebarCollapsed ? '60px' : '360px',
                background: '#f5f5f5',
                borderRight: '1px solid #e8e8e8',
                overflow: 'auto',
                padding: sidebarCollapsed ? '16px 8px' : '16px',
                transition: 'width 0.3s ease'
            }}>
                {!sidebarCollapsed ? (
                    <>
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

                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, marginBottom: '8px' }}>🌍 国际课程</h3>
                            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                                加州大学 · 托福/雅思备考
                            </p>
                        </div>

                        {courses.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                加载课程中...
                            </div>
                        ) : (
                            courses.map(course => (
                                <div key={course.id} style={{ marginBottom: '20px' }}>
                                    <div
                                        onClick={() => selectCourse(course)}
                                        style={{
                                            padding: '12px',
                                            background: selectedCourse?.id === course.id ? '#e6f7ff' : 'white',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            border: selectedCourse?.id === course.id ? '1px solid #91d5ff' : '1px solid #e8e8e8',
                                            marginBottom: '8px'
                                        }}
                                    >
                                        <div style={{ fontWeight: 'bold', fontSize: '14px', textAlign: 'left' }}>
                                            {course.name}
                                        </div>
                                    </div>
                                    
                                    {selectedCourse?.id === course.id && courseStructure && (
                                        <div style={{ marginLeft: '0px', borderLeft: 'none', paddingLeft: '0' }}>
                                            {renderTree(courseStructure, course.id)}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </>
                ) : (
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
                        <div style={{ fontSize: '24px' }}>🌍</div>
                        <div style={{ fontSize: '12px', color: '#666', writingMode: 'vertical-rl' }}>
                            国际课程
                        </div>
                    </div>
                )}
            </div>

            {/* 右侧内容区域 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                {!selectedCourse ? (
                    <div style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🌍</div>
                        <div style={{ fontSize: '18px', marginBottom: '8px' }}>加州大学国际课程</div>
                        <div style={{ fontSize: '14px' }}>托福 · 雅思备考专项</div>
                        <div style={{ fontSize: '12px', marginTop: '16px', color: '#bbb' }}>从左侧选择一个课程开始学习</div>
                    </div>
                ) : (
                    <div>
                        {/* 视频播放器 */}
                        {videoUrl && (
                            <div key={videoKey}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px' }}>{selectedVideo?.name}</h3>
                                    <button onClick={downloadVideo} style={{ padding: '4px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>📥 下载视频</button>
                                </div>
                                <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
                                    <video ref={videoRef} controls style={{ width: '100%', maxHeight: '500px' }} crossOrigin="anonymous" key={videoKey}>
                                        <source src={videoUrl} type="video/mp4" />
                                        {subtitleUrl && <track kind="subtitles" label="English" srcLang="en" src={subtitleUrl} default />}
                                        您的浏览器不支持视频播放
                                    </video>
                                </div>
                            </div>
                        )}

                        {/* 课程讲义 PDF - 始终显示在视频下方（只要 coursePdfUrl 存在） */}
                        {coursePdfUrl && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{
                                    background: '#f0f7ff',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    marginBottom: '12px',
                                    borderLeft: '4px solid #1890ff',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '8px'
                                }}>
                                    <span><strong>📘 课程讲义</strong><span style={{ fontSize: '12px', color: '#666', marginLeft: '12px' }}>加州大学官方备考资料</span></span>
                                    <a href={coursePdfUrl} download style={{ padding: '4px 12px', background: '#52c41a', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '12px' }}>📥 下载PDF</a>
                                </div>
                                <div style={{ border: '1px solid #e8e8e8', borderRadius: '8px', overflow: 'hidden', background: '#fafafa', height: '60vh' }}>
                                    <iframe src={coursePdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="课程讲义" />
                                </div>
                            </div>
                        )}

                        {/* 没有任何内容时的提示 */}
                        {!videoUrl && !coursePdfUrl && (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
                                <div>从左侧目录选择视频开始学习</div>
                                <div style={{ fontSize: '13px', marginTop: '8px' }}>包含视频课程和配套讲义</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default InternationalCourses;