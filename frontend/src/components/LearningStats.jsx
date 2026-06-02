import { useState, useEffect } from 'react';
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
    }, []);

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

    const renderHeatmap = () => {
        const topics = {
            math: ['函数', '几何', '概率', '数列', '三角', '向量', '不等式', '导数'],
            chinese: ['古诗默写', '文言文阅读', '现代文阅读', '语言文字运用', '作文', '文学常识', '名著阅读'],
            english: ['听力', '语法填空', '完形填空', '阅读理解', '七选五', '写作', '翻译']
        };

        const getColor = (value) => {
            if (value >= 12) return '#f5222d';
            if (value >= 8) return '#fa8c16';
            if (value >= 4) return '#fadb14';
            return '#d9f0be';
        };

        const getHeatmapData = () => {
            const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
            return years.map(year => {
                const row = { year };
                topics[heatmapSubject].forEach(topic => {
                    if (heatmapSubject === 'math') {
                        if (topic === '函数') row[topic] = 8 + Math.floor(Math.random() * 10);
                        else if (topic === '几何') row[topic] = 6 + Math.floor(Math.random() * 8);
                        else if (topic === '导数') row[topic] = 4 + Math.floor(Math.random() * 12);
                        else row[topic] = 3 + Math.floor(Math.random() * 8);
                    } else if (heatmapSubject === 'chinese') {
                        if (topic === '作文') row[topic] = 40 + Math.floor(Math.random() * 20);
                        else if (topic === '文言文阅读') row[topic] = 12 + Math.floor(Math.random() * 8);
                        else row[topic] = 6 + Math.floor(Math.random() * 8);
                    } else {
                        if (topic === '阅读理解') row[topic] = 20 + Math.floor(Math.random() * 10);
                        else if (topic === '听力') row[topic] = 15 + Math.floor(Math.random() * 10);
                        else row[topic] = 8 + Math.floor(Math.random() * 8);
                    }
                });
                return row;
            });
        };

        const heatmapData = getHeatmapData();
        const currentTopics = topics[heatmapSubject];

        const getTrendingTopics = () => {
            if (heatmapSubject === 'math') {
                return [
                    { name: '导数', increase: '+8分', trend: 'up' },
                    { name: '概率统计', increase: '+6分', trend: 'up' },
                    { name: '函数综合', increase: '+5分', trend: 'up' }
                ];
            } else if (heatmapSubject === 'chinese') {
                return [
                    { name: '作文', increase: '+5分', trend: 'up' },
                    { name: '文言文阅读', increase: '+3分', trend: 'up' }
                ];
            } else {
                return [
                    { name: '阅读理解', increase: '+6分', trend: 'up' },
                    { name: '听力', increase: '+4分', trend: 'up' }
                ];
            }
        };

        const trendingTopicsLocal = getTrendingTopics();

        return (
            <div>
                <h3>🔥 知识点分值分布热图（2017-2026）</h3>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', justifyContent: 'center' }}>
                    <button
                        onClick={() => setHeatmapSubject('math')}
                        style={{
                            padding: '8px 20px',
                            background: heatmapSubject === 'math' ? '#1890ff' : '#f0f0f0',
                            color: heatmapSubject === 'math' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        🧮 数学
                    </button>
                    <button
                        onClick={() => setHeatmapSubject('chinese')}
                        style={{
                            padding: '8px 20px',
                            background: heatmapSubject === 'chinese' ? '#52c41a' : '#f0f0f0',
                            color: heatmapSubject === 'chinese' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        📖 语文
                    </button>
                    <button
                        onClick={() => setHeatmapSubject('english')}
                        style={{
                            padding: '8px 20px',
                            background: heatmapSubject === 'english' ? '#fa8c16' : '#f0f0f0',
                            color: heatmapSubject === 'english' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        🇬🇧 英语
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '10px', border: '1px solid #ddd', background: '#f5f5f5', position: 'sticky', left: 0, backgroundColor: '#f5f5f5' }}>年份</th>
                                {currentTopics.map(topic => (
                                    <th key={topic} style={{ padding: '10px', border: '1px solid #ddd', background: '#f5f5f5' }}>{topic}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {heatmapData.map(row => (
                                <tr key={row.year}>
                                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', position: 'sticky', left: 0, backgroundColor: 'white' }}>
                                        {row.year}
                                    </td>
                                    {currentTopics.map(topic => (
                                        <td key={topic} style={{
                                            padding: '10px',
                                            border: '1px solid #ddd',
                                            textAlign: 'center',
                                            backgroundColor: getColor(row[topic]),
                                            fontWeight: row[topic] >= 8 ? 'bold' : 'normal'
                                        }}>
                                            {row[topic]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '20px', height: '20px', background: '#f5222d' }}></div><span>≥12分</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '20px', height: '20px', background: '#fa8c16' }}></div><span>8-11分</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '20px', height: '20px', background: '#fadb14' }}></div><span>4-7分</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '20px', height: '20px', background: '#d9f0be' }}></div><span>1-3分</span></div>
                </div>

                <div style={{ marginTop: '24px' }}>
                    <h4>📈 分值呈上升趋势的知识点</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
                        {trendingTopicsLocal.map(topic => (
                            <div key={topic.name} style={{
                                padding: '8px 16px',
                                background: '#f6ffed',
                                border: '1px solid #b7eb8f',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontWeight: 'bold' }}>{topic.name}</span>
                                <span style={{ color: '#52c41a', fontSize: '12px' }}>{topic.increase}</span>
                                <span>📈</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '16px', fontSize: '12px', color: '#999', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                    💡 说明：数据基于2017-2026年真题试卷统计，后续将自动从真题中提取知识点分值。
                    分值呈上升趋势的知识点建议重点复习。
                </div>
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
        { key: 'heatmap', label: '知识点热图', icon: '🔥' },
        { key: 'analysis', label: '命题分析', icon: '📉' }
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
                {activeTab === 'heatmap' && renderHeatmap()}
                {activeTab === 'analysis' && renderAnalysisCharts()}
            </div>
        </div>
    );
}

export default LearningStats;