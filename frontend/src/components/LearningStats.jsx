import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
    BarChart, Bar,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ComposedChart, Area
} from 'recharts';

function LearningStats() {
    const [activeTab, setActiveTab] = useState('progress');
    const [subjectProgress, setSubjectProgress] = useState([]);
    const [scoreTrend, setScoreTrend] = useState([]);
    const [trendStats, setTrendStats] = useState([]);
    const [radarData, setRadarData] = useState([]);
    const [dailyStudyTime, setDailyStudyTime] = useState([]);
    const [knowledgeHeatmap, setKnowledgeHeatmap] = useState([]);
    const [trendingTopics, setTrendingTopics] = useState([]);
    const [heatmapSubject, setHeatmapSubject] = useState('math');

    const [profileData, setProfileData] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [weakPointData, setWeakPointData] = useState({ weakPoints: [], relatedTopics: [], totalWrong: 0 });
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [knowledgeGraphData, setKnowledgeGraphData] = useState(null);
    const [knowledgeSubject, setKnowledgeSubject] = useState('chinese');
    const [loadingKnowledgeGraph, setLoadingKnowledgeGraph] = useState(false);
    const [selectedKnowledgeNode, setSelectedKnowledgeNode] = useState(null);
    const treeChartRef = useRef(null);
    const forceChartRef = useRef(null);    

    // ========== 命题分析图表相关状态 ==========
    const [analysisSubject, setAnalysisSubject] = useState('math');
    const subjectMap = {
        math: { name: '数学', folder: '数学' },
        chinese: { name: '语文', folder: '语文' },
        english: { name: '英语', folder: '英语' }
    };
    // 修正：file 字段与实际文件名完全一致
    const chartList = [
        { key: 'heatmap1', title: '2017-2026年 考点-分值热图', file: '2017-2026年 考点-分值热图.png' },
        { key: 'heatmap2', title: '2022-2026年 考点-分值热图', file: '2022-2026年 考点-分值热图.png' },
        { key: 'trend', title: '2017-2029年 分值趋势（含预测）', file: '2017-2029年 分值趋势（含预测）.png' },
        { key: 'difficultyTrend', title: '2017-2029年 难度趋势（含预测）', file: '2017-2029年 难度趋势（含预测）.png' },
        { key: 'difficultyRatio', title: '2017-2026年 难度-分值占比', file: '2017-2026年 难度-分值占比.png' }
    ];

    const subjects = [
        { key: 'chinese', name: '语文', color: '#52c41a' },
        { key: 'math', name: '数学', color: '#1890ff' },
        { key: 'english', name: '英语', color: '#fa8c16' }
    ];
    const subjectNames = { chinese: '语文', math: '数学', english: '英语' };

    // 线性回归计算
    const linearRegression = (data) => {
        const n = data.length;
        if (n < 2) return { a: 0, b: 0, r2: 0, ci: 0 };
        
        const indices = data.map((_, i) => i + 1);
        const scores = data.map(d => d.score);
        
        const sumX = indices.reduce((s, x) => s + x, 0);
        const sumY = scores.reduce((s, y) => s + y, 0);
        const sumXY = indices.reduce((s, x, i) => s + x * scores[i], 0);
        const sumX2 = indices.reduce((s, x) => s + x * x, 0);
        
        const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const a = (sumY - b * sumX) / n;
        
        const yMean = sumY / n;
        const ssRes = indices.reduce((s, x, i) => s + (scores[i] - (a + b * x)) ** 2, 0);
        const ssTot = scores.reduce((s, y) => s + (y - yMean) ** 2, 0);
        const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
        
        const residuals = indices.map((x, i) => scores[i] - (a + b * x));
        const se = Math.sqrt(residuals.reduce((s, r) => s + r ** 2, 0) / (n - 2));
        const ci = 1.96 * se;
        
        return { a, b, r2, ci };
    };

    useEffect(() => {
        loadProgressData();
        loadScoreTrendData();
        loadRadarData();
        loadDailyStudyData();
        loadKnowledgeHeatmap();
        loadProfile();
        loadHistory();
        loadWeakPoints();
        loadKnowledgeGraph();
    }, []);

    const loadProfile = async () => {
        setLoadingProfile(true);
        try {
            const res = await axios.get('http://localhost:3001/api/student/profile');
            if (res.data.success) {
                setProfileData(res.data.data);
            }
        } catch (err) {
            console.error('加载画像失败:', err);
        } finally {
            setLoadingProfile(false);
        }
    };

    const loadHistory = async () => {
        try {
            const res = await axios.get('http://localhost:3001/api/student/history');
            if (res.data.success) {
                setHistoryData(res.data.history);
            }
        } catch (err) {
            console.error('加载历史失败:', err);
        }
    };

    const loadWeakPoints = async () => {
        try {
            const res = await axios.get('http://localhost:3001/api/student/weak-points');
            if (res.data.success) {
                setWeakPointData(res.data.data || { weakPoints: [], relatedTopics: [], totalWrong: 0 });
            }
        } catch (err) {
            console.error('加载薄弱知识点失败:', err);
        }
    };

    const loadKnowledgeGraph = async () => {
        setLoadingKnowledgeGraph(true);
        try {
            const res = await axios.get('http://localhost:3001/api/knowledge/graph?subject=all');
            if (res.data.success) {
                setKnowledgeGraphData(res.data.data || {});
            }
        } catch (err) {
            console.error('加载知识图谱失败:', err);
        } finally {
            setLoadingKnowledgeGraph(false);
        }
    };    

    const loadProgressData = () => {
        const progressData = [];
        const subjectTotals = { chinese: 0, math: 0, english: 0 };

        for (const subject of subjects.map(s => s.key)) {
            const total2025 = parseInt(localStorage.getItem(`total_${subject}_2025`) || 0);
            const total2026 = parseInt(localStorage.getItem(`total_${subject}_2026`) || 0);
            subjectTotals[subject] = total2025 + total2026;
        }

        for (const subject of subjects.map(s => s.key)) {
            let completed = 0;
            const total = subjectTotals[subject];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`topic_${subject}_`) && key.endsWith('_status')) {
                    try {
                        const status = JSON.parse(localStorage.getItem(key));
                        if (status.completed) completed++;
                    } catch (e) {}
                }
            }

            progressData.push({
                name: subjectNames[subject],
                value: total > 0 ? Math.round((completed / total) * 100) : 0,
                total: total,
                completed: completed,
                color: subjects.find(s => s.key === subject)?.color
            });
        }

        setSubjectProgress(progressData);
    };

    const loadScoreTrendData = () => {
        const scoresBySubject = {
            chinese: [],
            math: [],
            english: []
        };
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('score_')) {
                try {
                    const record = JSON.parse(localStorage.getItem(key));
                    if (scoresBySubject[record.subject]) {
                        scoresBySubject[record.subject].push({
                            testNumber: record.testNumber,
                            score: record.score,
                            timestamp: record.timestamp
                        });
                    }
                } catch (e) {}
            }
        }
        
        // 添加示例数据（如果没有真实数据）
        for (const subject of ['chinese', 'math', 'english']) {
            if (scoresBySubject[subject].length === 0) {
                for (let i = 1; i <= 5; i++) {
                    scoresBySubject[subject].push({
                        testNumber: i,
                        score: 60 + Math.floor(Math.random() * 30),
                        timestamp: new Date().toISOString()
                    });
                }
            }
            scoresBySubject[subject].sort((a, b) => a.testNumber - b.testNumber);
        }
        
        const maxLen = Math.max(
            scoresBySubject.chinese.length,
            scoresBySubject.math.length,
            scoresBySubject.english.length
        );
        
        const chartData = [];
        for (let i = 0; i < maxLen; i++) {
            const dataPoint = { testNumber: i + 1 };
            for (const subject of subjects) {
                const score = scoresBySubject[subject.key][i]?.score || null;
                dataPoint[subject.name] = score;
            }
            chartData.push(dataPoint);
        }
        
        setScoreTrend(chartData);
        
        const stats = subjects.map(subject => {
            const scores = scoresBySubject[subject.key];
            const { a, b, r2, ci } = linearRegression(scores);
            
            return {
                ...subject,
                scores,
                trend: { a, b, r2, ci },
                hasData: scores.length > 0
            };
        });
        
        setTrendStats(stats);
    };

    const loadRadarData = () => {
        const data = subjects.map(subject => {
            let knowledgePoints = [];
            if (subject.key === 'chinese') {
                knowledgePoints = [
                    { subject: '基础知识', value: 75 },
                    { subject: '阅读理解', value: 60 },
                    { subject: '古文古诗', value: 82 },
                    { subject: '作文写作', value: 68 },
                    { subject: '语言运用', value: 70 }
                ];
            } else if (subject.key === 'math') {
                knowledgePoints = [
                    { subject: '代数', value: 75 },
                    { subject: '几何', value: 60 },
                    { subject: '三角', value: 82 },
                    { subject: '概率', value: 68 },
                    { subject: '函数', value: 70 }
                ];
            } else {
                knowledgePoints = [
                    { subject: '词汇', value: 75 },
                    { subject: '语法', value: 60 },
                    { subject: '阅读', value: 82 },
                    { subject: '写作', value: 68 },
                    { subject: '听力', value: 70 }
                ];
            }
            return {
                name: subject.name,
                key: subject.key,
                color: subject.color,
                data: knowledgePoints
            };
        });
        setRadarData(data);
    };

    const loadDailyStudyData = () => {
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = `study_${date.toISOString().split('T')[0]}`;
            let minutes = parseInt(localStorage.getItem(dateKey)) || 0;
            if (minutes === 0) {
                minutes = Math.floor(Math.random() * 60) + 20;
            }
            last7Days.push({
                date: `${date.getMonth() + 1}/${date.getDate()}`,
                minutes: minutes
            });
        }
        setDailyStudyTime(last7Days);
    };

    const loadKnowledgeHeatmap = () => {
        const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
        const topics = ['函数', '几何', '概率', '数列', '三角', '向量', '不等式', '导数'];
        
        const heatmapData = years.map(year => {
            const row = { year };
            topics.forEach(topic => {
                row[topic] = Math.floor(Math.random() * 15);
            });
            return row;
        });
        setKnowledgeHeatmap(heatmapData);
        
        const trending = [
            { name: '导数', increase: '+8分', trend: 'up' },
            { name: '概率统计', increase: '+6分', trend: 'up' },
            { name: '函数综合', increase: '+5分', trend: 'up' },
            { name: '数列', increase: '+3分', trend: 'up' },
            { name: '立体几何', increase: '+2分', trend: 'up' }
        ];
        setTrendingTopics(trending);
    };

    // ==================== 原有图表渲染函数 ====================
    const renderProgressChart = () => {
        const totalCompleted = subjectProgress.reduce((sum, s) => sum + s.completed, 0);
        const totalTopics = subjectProgress.reduce((sum, s) => sum + s.total, 0);
        const avgProgress = subjectProgress.length > 0 
            ? Math.round(subjectProgress.reduce((sum, s) => sum + s.value, 0) / subjectProgress.length) 
            : 0;

        return (
            <div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    marginBottom: '24px'
                }}>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1890ff' }}>{totalCompleted}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>已完成专题</div>
                    </div>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#52c41a' }}>{totalTopics}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>总专题数</div>
                    </div>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fa8c16' }}>{avgProgress}%</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>平均进度</div>
                    </div>
                </div>

                <h3>📊 各学科进度详情</h3>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '40px',
                    marginTop: '20px'
                }}>
                    {subjectProgress.map((item) => (
                        <div key={item.name} style={{ textAlign: 'center', width: '200px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '10px', color: item.color }}>
                                {item.name}
                            </div>
                            <ResponsiveContainer width={180} height={180}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: '已完成', value: item.completed },
                                            { name: '未完成', value: Math.max(0, item.total - item.completed) }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        dataKey="value"
                                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                    >
                                        <Cell fill={item.color} />
                                        <Cell fill="#e8e8e8" />
                                    </Pie>
                                    <Tooltip formatter={(value) => `${value} 个专题`} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ marginTop: '10px', fontSize: '13px' }}>
                                已完成: {item.completed} / {item.total}
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: item.color }}>
                                {item.value}%
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderTrendChart = () => {
        return (
            <div>
                <h3>📈 成绩趋势分析</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={scoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="testNumber" label={{ value: '测验序号', position: 'insideBottom', offset: -5 }} />
                        <YAxis domain={[0, 100]} label={{ value: '成绩（分）', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => `${value}分`} />
                        <Legend />
                        {subjects.map(subject => (
                            <Line
                                key={subject.key}
                                type="monotone"
                                dataKey={subject.name}
                                name={subject.name}
                                stroke={subject.color}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                connectNulls
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
                
                <div style={{ marginTop: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {trendStats.map(subject => (
                        subject.hasData && (
                            <div key={subject.key} style={{ 
                                background: 'white', 
                                padding: '12px', 
                                borderRadius: '8px',
                                flex: 1,
                                minWidth: '180px',
                                borderLeft: `4px solid ${subject.color}`,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{ fontWeight: 'bold', color: subject.color }}>{subject.name}</div>
                                <div style={{ fontSize: '12px' }}>已测 {subject.scores.length} 次</div>
                                <div style={{ fontSize: '12px' }}>
                                    趋势: {subject.trend.b > 0 ? '📈 上升' : subject.trend.b < 0 ? '📉 下降' : '➡️ 平稳'}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>R²: {subject.trend.r2.toFixed(3)}</div>
                                {subject.trend.b > 0 && (
                                    <div style={{ fontSize: '11px', color: '#52c41a', marginTop: '4px' }}>
                                        预计下次 +{subject.trend.b.toFixed(1)} 分
                                    </div>
                                )}
                            </div>
                        )
                    ))}
                </div>
                
                {scoreTrend.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        暂无成绩数据，完成学生版测验后会自动记录
                    </div>
                )}
            </div>
        );
    };

    const renderRadarChart = () => {
        return (
            <div>
                <h3>🎯 各学科知识点掌握度</h3>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '30px',
                    marginTop: '20px'
                }}>
                    {radarData.map(subject => (
                        <div key={subject.key} style={{ textAlign: 'center', width: '320px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '10px', color: subject.color }}>
                                {subject.name}
                            </div>
                            <ResponsiveContainer width={300} height={280}>
                                <RadarChart data={subject.data}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                    <Radar name="掌握度" dataKey="value" stroke={subject.color} fill={subject.color} fillOpacity={0.5} />
                                    <Tooltip formatter={(value) => `${value}分`} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    ))}
                </div>
                <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '16px' }}>
                    注：数据来源于测验答题记录
                </div>
            </div>
        );
    };

    const renderBarChart = () => {
        const totalMinutes = dailyStudyTime.reduce((sum, d) => sum + d.minutes, 0);
        const avgMinutes = Math.round(totalMinutes / dailyStudyTime.length);
        
        return (
            <div>
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    marginBottom: '20px',
                    justifyContent: 'center'
                }}>
                    <div style={{ background: 'white', padding: '12px 20px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>{totalMinutes}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>总学习时长(分钟)</div>
                    </div>
                    <div style={{ background: 'white', padding: '12px 20px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>{avgMinutes}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>日均(分钟)</div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailyStudyTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis label={{ value: '分钟', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => `${value} 分钟`} />
                        <Bar dataKey="minutes" fill="#52c41a" name="学习时长" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const exportFullChart = async (chartRef, fileName) => {
        const chart = chartRef?.current?.getEchartsInstance?.();
        if (!chart) return;

        const dataUrlToBlob = (dataUrl) => {
            const parts = dataUrl.split(',');
            if (parts.length < 2) return null;

            const header = parts[0];
            const data = parts.slice(1).join(',');
            const isBase64 = header.includes(';base64');
            const mimeMatch = header.match(/data:([^;]+)(;charset=[^;]+)?/);
            const mimeType = mimeMatch ? `${mimeMatch[1]}${mimeMatch[2] || ''}` : 'image/svg+xml;charset=utf-8';

            if (isBase64) {
                const binary = atob(data);
                const len = binary.length;
                const buffer = new Uint8Array(len);
                for (let i = 0; i < len; i += 1) {
                    buffer[i] = binary.charCodeAt(i);
                }
                return new Blob([buffer], { type: mimeType });
            }

            return new Blob([decodeURIComponent(data)], { type: mimeType });
        };

        const prevWidth = chart.getWidth?.() || 0;
        const prevHeight = chart.getHeight?.() || 0;

        try {
            chart.resize({ width: 1600, height: 1100 });
            let dataUrl = chart.getDataURL({
                type: 'svg',
                backgroundColor: '#ffffff'
            });

            if (!dataUrl.includes('charset=utf-8')) {
                dataUrl = dataUrl.replace('data:image/svg+xml', 'data:image/svg+xml;charset=utf-8');
            }

            const blob = dataUrlToBlob(dataUrl);
            if (!blob) return;

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}.svg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 300);
        } finally {
            if (prevWidth && prevHeight) {
                chart.resize({ width: prevWidth, height: prevHeight });
            } else {
                chart.resize();
            }
        }
    };

    const renderKnowledgeGraph = () => {
        const current = knowledgeGraphData?.[knowledgeSubject] || null;
        if (loadingKnowledgeGraph) return <div>正在加载知识图谱…</div>;
        if (!current) return <div>暂无知识图谱数据，请先完成题库与知识点映射。</div>;

        const treeOption = {
            tooltip: {
                trigger: 'item',
                formatter: (params) => `${params.name}<br/>关联题数：${params.data.value || 0}${params.data.support ? `<br/>支持力：${params.data.support.toFixed(2)}` : ''}${params.data.confidence ? `<br/>置信度：${params.data.confidence.toFixed(2)}` : ''}`
            },
            toolbox: {
                show: true,
                right: 10,
                feature: {
                    saveAsImage: {
                        show: true,
                        title: '下载完整大图',
                        type: 'png',
                        pixelRatio: 4,
                        backgroundColor: '#ffffff',
                        excludeComponents: ['toolbox']
                    },
                    restore: { show: true, title: '重置视图' },
                    dataZoom: { show: true, title: { zoom: '区域缩放', back: '取消缩放' } }
                }
            },
            series: [{
                type: 'tree',
                data: [current.tree],
                top: '5%',
                left: '8%',
                bottom: '5%',
                right: '22%',
                symbolSize: 8,
                orient: 'LR',
                roam: true,
                expandAndCollapse: true,
                initialTreeDepth: 2,
                label: { position: 'left', rotate: 0, fontSize: 10, minMargin: 6, overflow: 'breakAll' },
                leaves: { label: { position: 'right' } },
                lineStyle: { color: 'rgba(24, 144, 255, 0.35)', width: 1.2 },
                emphasis: { focus: 'descendant' },
                animationDurationUpdate: 500
            }]
        };

        const supportNodes = [
            { id: current.subject, name: current.subjectName, value: current.summary?.totalQuestionLinks || 0, support: current.summary?.totalQuestionLinks || 0, symbolSize: 42, category: 0, itemStyle: { color: '#4C6FFF', borderColor: '#fff', borderWidth: 2 } },
            ...current.support.slice(0, 10).map((item, index) => ({
                id: `kp_${index}`,
                name: item.name,
                value: item.support,
                support: item.support,
                confidence: item.confidence || 0,
                symbolSize: 14 + item.support * 1.8,
                category: 1,
                itemStyle: { color: index % 3 === 0 ? '#52C41A' : index % 3 === 1 ? '#FA8C16' : '#722ED1', borderColor: '#fff', borderWidth: 1.5 }
            }))
        ];

        const supportEdges = current.support.slice(0, 10).map((item, index) => ({
            source: current.subject,
            target: `kp_${index}`,
            value: item.support,
            lineStyle: {
                width: 1 + item.support * 0.7,
                color: index % 3 === 0 ? 'rgba(76, 111, 255, 0.45)' : index % 3 === 1 ? 'rgba(114, 46, 209, 0.45)' : 'rgba(250, 140, 22, 0.35)'
            }
        }));

        const supportOption = {
            tooltip: {
                trigger: 'item',
                formatter: (params) => `${params.data.name || params.name}<br/>支持题数：${params.data.value || params.value || 0}<br/>支持力：${(params.data.support || 0).toFixed(2)}`
            },
            toolbox: {
                show: true,
                right: 10,
                feature: {
                    saveAsImage: {
                        show: true,
                        title: '下载完整大图',
                        type: 'png',
                        pixelRatio: 4,
                        backgroundColor: '#ffffff',
                        excludeComponents: ['toolbox']
                    },
                    restore: { show: true, title: '重置视图' },
                    dataZoom: { show: true, title: { zoom: '区域缩放', back: '取消缩放' } }
                }
            },
            legend: [{ data: ['学科', '知识点'] }],
            series: [{
                type: 'graph',
                layout: 'force',
                roam: true,
                draggable: true,
                force: { repulsion: 220, gravity: 0.06, edgeLength: 90 },
                data: supportNodes,
                links: supportEdges,
                categories: [
                    { name: '学科', itemStyle: { color: '#4C6FFF' } },
                    { name: '知识点', itemStyle: { color: '#52C41A' } }
                ],
                edgeSymbol: ['none', 'arrow'],
                edgeSymbolSize: [0, 6],
                lineStyle: { color: 'rgba(76, 111, 255, 0.45)', width: 1.5, curveness: 0.08 },
                label: { show: true, position: 'right', formatter: '{b}', color: '#1f1f1f', fontSize: 11 },
                itemStyle: { borderColor: '#ffffff', borderWidth: 1.5 },
                emphasis: { focus: 'adjacency', scale: true },
                silent: false
            }]
        };

        return (
            <div>
                {selectedKnowledgeNode && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                        <div style={{ width: 'min(420px, 100%)', background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{selectedKnowledgeNode.title}</div>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{selectedKnowledgeNode.subject}</div>
                                </div>
                                <button onClick={() => setSelectedKnowledgeNode(null)} style={{ border: 'none', background: '#f5f5f5', borderRadius: '999px', padding: '6px 10px', cursor: 'pointer' }}>关闭</button>
                            </div>
                            <div style={{ fontSize: '13px', color: '#444', marginTop: '12px', lineHeight: 1.6 }}>{selectedKnowledgeNode.detail}</div>
                            {selectedKnowledgeNode.id ? <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>ID：{selectedKnowledgeNode.id}</div> : null}
                        </div>
                    </div>
                )}

                <h3>🧭 知识点树图（{current.subjectName}）</h3>
                <p style={{ color: '#666', marginBottom: '12px' }}>基于 question_knowledge_points 映射生成，突出知识点分层与题目联系强度。</p>
                <div style={{ background: 'white', borderRadius: '12px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>提示：可鼠标滚轮缩放、拖拽布局；点击节点可查看详细信息。</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                        <button
                            onClick={() => exportFullChart(treeChartRef, `${current.subjectName}-知识点树图`)}
                            style={{ border: '1px solid #d9d9d9', background: '#fff', borderRadius: '999px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}
                        >
                            下载完整大图
                        </button>
                    </div>
                    <ReactECharts
                        ref={treeChartRef}
                        option={treeOption}
                        opts={{ renderer: 'svg' }}
                        style={{ height: '420px', width: '100%' }}
                        onEvents={{
                            click: (params) => {
                                if (!params?.data) return;
                                setSelectedKnowledgeNode({
                                    title: params.data.name || '知识点',
                                    subject: current.subjectName,
                                    detail: `关联题数：${params.data.value || 0}${params.data.support ? ` · 支持力：${params.data.support.toFixed(2)}` : ''}${params.data.confidence ? ` · 置信度：${params.data.confidence.toFixed(2)}` : ''}`,
                                    id: params.data.id || ''
                                });
                            }
                        }}
                    />
                </div>

                <h3 style={{ marginTop: '24px' }}>💡 支持力导向图（{current.subjectName}）</h3>
                <p style={{ color: '#666', marginBottom: '12px' }}>节点大小与连线粗细由题目支持次数与映射权重决定，便于识别核心考点。</p>
                <div style={{ background: 'white', borderRadius: '12px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                        <button
                            onClick={() => exportFullChart(forceChartRef, `${current.subjectName}-支持力导向图`)}
                            style={{ border: '1px solid #d9d9d9', background: '#fff', borderRadius: '999px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}
                        >
                            下载完整大图
                        </button>
                    </div>
                    <ReactECharts ref={forceChartRef} option={supportOption} opts={{ renderer: 'svg' }} style={{ height: '420px', width: '100%' }} />
                </div>

                <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {Object.entries(knowledgeGraphData || {}).map(([key, item]) => (
                        <button
                            key={key}
                            onClick={() => setKnowledgeSubject(key)}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '16px',
                                border: knowledgeSubject === key ? '1px solid #1890ff' : '1px solid #d9d9d9',
                                background: knowledgeSubject === key ? '#e6f7ff' : 'white',
                                color: knowledgeSubject === key ? '#1890ff' : '#333',
                                cursor: 'pointer'
                            }}
                        >
                            {item.subjectName}（{item.summary?.totalKnowledgePoints || 0}点 / {item.summary?.totalQuestionLinks || 0}题）
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderProfile = () => {
        if (loadingProfile) return <div>加载中...</div>;
        if (!profileData) return <div>暂无数据，请先完成答题卡批改。</div>;

        const { total_questions_answered, total_correct, total_wrong, average_score, accuracy, weak_knowledge_points } = profileData;
        const weakPoints = Array.isArray(weak_knowledge_points) ? weak_knowledge_points : weakPointData.weakPoints || [];
        const masteryData = weakPoints.slice(0, 6).map(item => ({
            subject: item.name || '未知知识点',
            value: Number(item.accuracy || 0),
            wrongCount: Number(item.wrong_count || 0)
        }));
        const trendData = historyData.slice().reverse().map(item => ({
            date: item.created_at ? new Date(item.created_at).toLocaleDateString() : '未知时间',
            accuracy: Number(item.accuracy || 0),
            score: Number(item.total_score || 0) / Math.max(Number(item.max_score || 1), 1) * 100
        }));

        return (
            <div>
                <h3>📊 学习概览</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1890ff' }}>{total_questions_answered}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>总答题数</div>
                    </div>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#52c41a' }}>{total_correct}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>正确数</div>
                    </div>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f5222d' }}>{total_wrong}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>错误数</div>
                    </div>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fa8c16' }}>{accuracy}%</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>正确率</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                    <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '12px' }}>📈 成绩进化趋势</h3>
                        {historyData.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>暂无答题记录</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                                    <Line type="monotone" dataKey="accuracy" stroke="#1890ff" name="正确率" />
                                    <Line type="monotone" dataKey="score" stroke="#52c41a" name="得分率" />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '12px' }}>🎯 知识点掌握度</h3>
                        {masteryData.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>暂无知识点掌握度数据</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <RadarChart data={masteryData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                                    <PolarRadiusAxis domain={[0, 100]} />
                                    <Radar dataKey="value" stroke="#fa8c16" fill="#fa8c16" fillOpacity={0.35} name="掌握度" />
                                    <Tooltip formatter={(value) => `${value}%`} />
                                </RadarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <h3 style={{ marginTop: '24px' }}>📉 薄弱点与学习专题</h3>
                {weakPoints.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>暂无薄弱知识点，继续保持！</div>
                ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {weakPoints.map((wp, idx) => {
                            const topicList = (weakPointData.relatedTopics || []).filter(item => item.knowledge_point_id === wp.id);
                            return (
                                <div key={idx} style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: '12px', padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{wp.name}</div>
                                            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                                错题次数：{wp.wrong_count || 0} · 近似掌握度：{wp.accuracy || 0}%
                                            </div>
                                        </div>
                                        <div style={{ color: '#f5222d', fontSize: '12px' }}>建议优先复习</div>
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                        关联专题：
                                        {topicList.length > 0
                                            ? topicList.map(item => `${item.topic_name}（${item.subject_id || '未知学科'} ${item.version_id || ''}）`).join('； ')
                                            : '暂无匹配专题，请前往“学习”模块查看相关课程。'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // ==================== 新增：命题分析图表渲染 ====================
    const renderAnalysisCharts = () => {
        return (
            <div>
                <h3>📊 命题规律可视化分析</h3>
                <p style={{ color: '#666', marginBottom: '20px' }}>
                    基于2017-2026年上海春考真题生成的考点趋势、难度预测及分值分布图。
                </p>

                {/* 学科切换按钮 */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', justifyContent: 'center' }}>
                    {Object.entries(subjectMap).map(([key, val]) => (
                        <button
                            key={key}
                            onClick={() => setAnalysisSubject(key)}
                            style={{
                                padding: '8px 24px',
                                background: analysisSubject === key ? '#1890ff' : '#f0f0f0',
                                color: analysisSubject === key ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '24px',
                                cursor: 'pointer',
                                fontSize: '15px',
                                fontWeight: analysisSubject === key ? 'bold' : 'normal',
                                transition: 'all 0.2s'
                            }}
                        >
                            {val.name}
                        </button>
                    ))}
                </div>

                {/* 五张图表展示 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    {chartList.map(chart => {
                        const imgUrl = `http://localhost:3001/analysis/${subjectMap[analysisSubject].folder}/${encodeURIComponent(chart.file)}`;
                        return (
                            <div key={chart.key} style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '20px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                border: '1px solid #f0f0f0'
                            }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#333', borderLeft: `4px solid ${analysisSubject === 'math' ? '#1890ff' : analysisSubject === 'chinese' ? '#52c41a' : '#fa8c16'}`, paddingLeft: '12px' }}>
                                    {chart.title}
                                </h4>
                                <div style={{ textAlign: 'center' }}>
                                    <img
                                        src={imgUrl}
                                        alt={chart.title}
                                        style={{
                                            maxWidth: '100%',
                                            height: 'auto',
                                            borderRadius: '8px',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                                        }}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            const parent = e.target.parentElement;
                                            if (parent && !parent.querySelector('.error-msg')) {
                                                const errorDiv = document.createElement('div');
                                                errorDiv.className = 'error-msg';
                                                errorDiv.style.padding = '40px';
                                                errorDiv.style.background = '#fff1f0';
                                                errorDiv.style.borderRadius = '8px';
                                                errorDiv.style.color = '#ff4d4f';
                                                errorDiv.innerHTML = `❌ 图片加载失败<br/>请检查文件是否存在：<br/>${imgUrl}`;
                                                parent.appendChild(errorDiv);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginTop: '30px', fontSize: '12px', color: '#999', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                    💡 提示：图片由 Python 脚本生成，存放于 <code>data/analysis/学科/</code> 目录。如无法显示，请确认后端已配置静态服务（<code>/analysis</code> 路由）且文件存在。
                </div>
            </div>
        );
    };

    // 选项卡配置（新增 "命题分析"）
    const tabs = [
        { key: 'progress', label: '学习进度', icon: '📊' },
        { key: 'trend', label: '成绩趋势', icon: '📈' },
        { key: 'radar', label: '掌握度雷达', icon: '🎯' },
        { key: 'time', label: '学习时长', icon: '⏰' },        
        { key: 'analysis', label: '命题分析', icon: '📉' },
        { key: 'profile', label: '学生画像', icon: '👤' },
        { key: 'knowledge', label: '知识图谱', icon: '🧭' }
    ];

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>📊 学习统计</h1>
            
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                borderBottom: '1px solid #e8e8e8',
                paddingBottom: '12px',
                flexWrap: 'wrap'
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '8px 20px',
                            background: activeTab === tab.key ? '#1890ff' : 'transparent',
                            color: activeTab === tab.key ? 'white' : '#333',
                            border: activeTab === tab.key ? 'none' : '1px solid #d9d9d9',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div style={{
                background: '#fafafa',
                borderRadius: '12px',
                padding: '24px',
                minHeight: '450px'
            }}>
                {activeTab === 'progress' && renderProgressChart()}
                {activeTab === 'trend' && renderTrendChart()}
                {activeTab === 'radar' && renderRadarChart()}
                {activeTab === 'time' && renderBarChart()}                
                {activeTab === 'analysis' && renderAnalysisCharts()}
                {activeTab === 'profile' && renderProfile()}
                {activeTab === 'knowledge' && renderKnowledgeGraph()}
            </div>
        </div>
    );
}

export default LearningStats;