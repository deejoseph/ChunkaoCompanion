import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

// 新增课程名称映射（支持新国际课程）
const COURSE_NAME_MAP = {
  '托福': '托福准备',
  '雅思': '雅思准备',
  '26年AP巴龙教辅书': 'AP课程（巴龙教辅）',
  '26年AP真题': 'AP真题',
  'A Level CIE教辅': 'A Level课程',
  'SAT教辅': 'SAT教辅',
  'SAT题库': 'SAT题库'
};

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
    const [expandedCourses, setExpandedCourses] = useState({});
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
            console.error('课程列表加载失败:', error);
        }
        setLoading(false);
    };

    const getCoursePdfUrl = (courseId) => {
        if (courseId.includes('TOEFL')) {
            return `${API_BASE}/api/international/root-file/加州大学托福备考特讲课程.pdf`;
        }
        if (courseId.includes('IELTS')) {
            return `${API_BASE}/api/international/root-file/加州大学雅思备考特讲课程.pdf`;
        }
        if (courseId.includes('A Level')) {
            return `${API_BASE}/api/international/root-file/A Level CIE教辅/讲义.pdf`; // 实际文件路径请根据服务器调整
        }
        if (courseId.includes('SAT')) {
            return `${API_BASE}/api/international/root-file/SAT教辅/数学.pdf`; // 实际文件路径请根据服务器调整
        }
        return null;
    };

    const doesUrlExist = async (url) => {
        try {
            await axios.head(url, { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    };

    const selectCourse = async (course) => {
        console.log('选择的课程:', course);
        setSelectedCourse(course);
        setVideoUrl('');
        setSubtitleUrl('');
        setCoursePdfUrl('');

        // 切换或初始化当前选中课程的展开状态
        setExpandedCourses(prev => ({
            ...prev,
            [course.id]: prev[course.id] !== undefined ? !prev[course.id] : true
        }));

        // AP/A Level/SAT 课程显示固定讲义 PDF
        if (course?.name.includes('AP') || course?.name.includes('A Level') || course?.name.includes('SAT')) {
            const pdfUrl = getCoursePdfUrl(course.id);
            if (pdfUrl && await doesUrlExist(pdfUrl)) {
                console.log('PDF URL:', pdfUrl);
                setCoursePdfUrl(pdfUrl);
            } else {
                console.log('固定讲义 PDF 不存在，已跳过展示:', pdfUrl);
            }
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
            console.error('课程结构加载失败:', error);
        }
        setLoading(false);
    };

    const toggleFolder = (path) => {
        setExpandedFolders(prev => ({
            ...prev,
            [path]: !prev[path]
        }));
        console.log('文件夹切换:', path, expandedFolders);
    };

    const toggleCourse = (courseId) => {
        setExpandedCourses(prev => ({
            ...prev,
            [courseId]: !prev[courseId]
        }));
        console.log('课程切换:', courseId, expandedCourses);
    };

    // 普通文件选择（支持视频和 PDF）
    const selectFile = (courseId, filePath, fileName, fileType) => {
        console.log('选择文件:', { filePath, fileName, fileType });

        if (fileType === 'video') {
            // 处理视频
            setVideoUrl('');
            setSubtitleUrl('');
            setSelectedVideo(null);

            // 🔥 关键修复：对于托福/雅思课程，不清除固定讲义 PDF
            // 只有 AP 课程才清除临时 PDF（因为 AP 没有固定讲义）
            if (selectedCourse && isAPCourse(selectedCourse)) {
                setCoursePdfUrl('');
            }
            // 注意：托福/雅思的固定讲义会保留，不执行 setCoursePdfUrl('')

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
        } else if (fileType === 'pdf') {
            // 处理 PDF 文件
            setVideoUrl('');
            setSubtitleUrl('');
            setSelectedVideo(null);
            const pdfUrl = `${API_BASE}/api/international/file/${courseId}/${encodeURIComponent(filePath)}`;
            setCoursePdfUrl(pdfUrl);
            console.log('PDF URL:', pdfUrl);
        } else {
            // 其他类型文件直接下载或打开
            window.open(`${API_BASE}/api/international/file/${courseId}/${encodeURIComponent(filePath)}`, '_blank');
        }
    };

    const downloadVideo = () => {
        if (!selectedVideo || !selectedCourse) return;
        const url = `${API_BASE}/api/international/file/${selectedCourse.id}/${encodeURIComponent(selectedVideo.path)}`;
        window.open(url, '_blank');
    };

    // 判断是否为 AP/A Level/SAT 课程
    const isAPCourse = (course) => {
        return course && (course.name.includes('AP') || course.name.includes('A Level') || course.name.includes('SAT'));
    };

    // 过滤文件列表（AP/A Level/SAT 课程显示所有文件，其他课程只显示视频和文件夹）
    const filterItems = (items, course) => {
        if (!items) return [];

        // AP/A Level/SAT 课程显示所有文件
        if (course?.name.includes('AP') || course?.name.includes('A Level') || course?.name.includes('SAT')) {
            return items.map(item => {
                if (item.type === 'folder' && item.children) {
                    return { ...item, children: filterItems(item.children, course) };
                }
                return item;
            });
        }

        // 其他课程只显示视频和文件夹
        return items.filter(item => {
            if (item.type === 'folder') return true;
            return item.fileType === 'video';
        }).map(item => {
            if (item.type === 'folder' && item.children) {
                return { ...item, children: filterItems(item.children, course) };
            }
            return item;
        });
    };

    const renderTree = (items, courseId, course, level = 0) => {
        if (!items) return null;
        const filteredItems = filterItems(items, course);

        return filteredItems.map((item, idx) => {
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
                                {renderTree(item.children, courseId, course, level + 1)}
                            </div>
                        )}
                    </div>
                );
            } else {
                // 文件节点
                let icon = '📄';
                let fileTypeDisplay = '';
                if (item.fileType === 'video') {
                    icon = '🎬';
                    fileTypeDisplay = '视频';
                } else if (item.fileType === 'pdf') {
                    icon = '📖';
                    fileTypeDisplay = 'PDF';
                } else if (item.fileType === 'document') {
                    icon = '📝';
                    fileTypeDisplay = '文档';
                } else {
                    icon = '📄';
                    fileTypeDisplay = '文件';
                }

                const isSelected = (item.fileType === 'video' && selectedVideo?.path === item.path) ||
                                   (item.fileType === 'pdf' && coursePdfUrl?.includes(encodeURIComponent(item.path)));

                return (
                    <div
                        key={item.path}
                        onClick={() => selectFile(courseId, item.path, item.name, item.fileType)}
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
                        <span>{icon}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                            {item.name}
                        </span>
                        <span style={{ fontSize: '10px', color: '#52c41a' }}>{fileTypeDisplay}</span>
                    </div>
                );
            }
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
                                加州大学 · 托福/雅思/AP 备考
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
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    background: selectedCourse?.id === course.id ? '#e6f7ff' : 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: selectedCourse?.id === course.id ? '1px solid #91d5ff' : '1px solid #e8e8e8',
                    marginBottom: '8px'
                }}
                onClick={() => selectCourse(course)}
            >
                <div style={{ fontWeight: 'bold', fontSize: '14px', textAlign: 'left' }}>
                    {course.name}
                </div>
<button
    onClick={(e) => {
        e.stopPropagation();
        toggleCourse(course.id);
    }}
    style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        color: '#1890ff'
    }}
>
    {expandedCourses[course.id] ? '🗂️ 收起' : '展开 ▼'}
</button>
            </div>
            
            {selectedCourse?.id === course.id && courseStructure && expandedCourses[course.id] && (
                <div style={{ marginLeft: '0px', borderLeft: 'none', paddingLeft: '0' }}>
                    {renderTree(courseStructure, course.id, course)}
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
                        <div style={{ fontSize: '18px', marginBottom: '8px' }}>国际课程</div>
                        <div style={{ fontSize: '14px' }}>托福 · 雅思 · AP 备考</div>
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

                        {/* 课程讲义 PDF（固定讲义或用户点击的 PDF） */}
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
                                    <span><strong>📘 文档预览</strong><span style={{ fontSize: '12px', color: '#666', marginLeft: '12px' }}>
                                        {selectedCourse?.name} 资料
                                    </span></span>
                                    <a href={coursePdfUrl} download style={{ padding: '4px 12px', background: '#52c41a', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '12px' }}>📥 下载文件</a>
                                </div>
                                {/* 🔥 修复 PDF 预览高度：从 60vh 改为 80vh */}
                                <div style={{ border: '1px solid #e8e8e8', borderRadius: '8px', overflow: 'hidden', background: '#fafafa', height: '80vh' }}>
                                    <iframe src={coursePdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="文档预览" />
                                </div>
                            </div>
                        )}

                        {/* 没有任何内容时的提示 */}
                        {!videoUrl && !coursePdfUrl && (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
                                <div>从左侧目录选择视频或 PDF 开始学习</div>
                                <div style={{ fontSize: '13px', marginTop: '8px' }}>AP 课程包含巴朗教辅 PDF 文件</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default InternationalCourses;