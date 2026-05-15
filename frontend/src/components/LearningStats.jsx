import { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    BarChart, Bar
} from 'recharts';
import axios from 'axios';

function LearningStats() {
    const [activeTab, setActiveTab] = useState('progress');
    const [subjectProgress, setSubjectProgress] = useState([]);
    const [scoreTrend, setScoreTrend] = useState([]);
    const [knowledgeMastery, setKnowledgeMastery] = useState([]);
    const [dailyStudyTime, setDailyStudyTime] = useState([]);

    const subjects = ['chinese', 'math', 'english'];
    const subjectNames = { chinese: '语文', math: '数学', english: '英语' };
    const colors = ['#52c41a', '#1890ff', '#fa8c16', '#eb2f96', '#722ed1'];

    // 加载学习进度数据
    useEffect(() => {
        loadProgressData();
        loadScoreTrendData();
        loadKnowledgeData();
        loadDailyStudyData();
    }, []);

    // 计算各学科进度
    const loadProgressData = () => {
        const progressData = [];

        // 各学科的总专题数（固定值，根据实际数据填写）
        const subjectTotals = {
            chinese: 0,
            math: 0,
            english: 0
        };

        // 从 localStorage 读取各学科的总数
        for (const subject of subjects) {
            const total2025 = parseInt(localStorage.getItem(`total_${subject}_2025`) || 0);
            const total2026 = parseInt(localStorage.getItem(`total_${subject}_2026`) || 0);
            subjectTotals[subject] = total2025 + total2026;
        }

        for (const subject of subjects) {
            let completed = 0;
            const total = subjectTotals[subject];

            // 遍历所有 localStorage 中的已完成专题
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
                completed: completed
            });
        }

        setSubjectProgress(progressData);
    };

    // 加载成绩趋势数据（从 localStorage 中提取所有有分数的专题）
    const loadScoreTrendData = () => {
        const scores = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`topic_`)) {
                try {
                    const status = JSON.parse(localStorage.getItem(key));
                    if (status.score !== undefined && status.score !== null) {
                        const topicName = key.replace('topic_', '').slice(0, 20);
                        scores.push({
                            name: topicName,
                            score: status.score,
                            date: status.completedAt ? new Date(status.completedAt).toLocaleDateString() : '未知'
                        });
                    }
                } catch (e) {}
            }
        }
        
        // 按时间排序（最多显示最近10条）
        scores.sort((a, b) => (a.date > b.date ? 1 : -1));
        setScoreTrend(scores.slice(-10));
    };

    // 加载知识点掌握度（模拟数据，后续可扩展）
    const loadKnowledgeData = () => {
        // 这里可以从 localStorage 扩展，暂时用模拟数据
        const knowledgeData = [
            { subject: '代数', value: 75, fullMark: 100 },
            { subject: '几何', value: 60, fullMark: 100 },
            { subject: '三角', value: 82, fullMark: 100 },
            { subject: '概率', value: 68, fullMark: 100 },
            { subject: '函数', value: 70, fullMark: 100 },
            { subject: '数列', value: 55, fullMark: 100 }
        ];
        setKnowledgeMastery(knowledgeData);
    };

    // 加载每日学习时间（模拟数据）
    const loadDailyStudyData = () => {
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push({
                date: `${date.getMonth() + 1}/${date.getDate()}`,
                minutes: Math.floor(Math.random() * 60) + 20  // 模拟数据，后续可真实统计
            });
        }
        setDailyStudyTime(last7Days);
    };

    // 饼图渲染 - 始终显示三个学科
    const renderProgressChart = () => {
        // 确保三个学科都显示（即使 total=0）
        const displayData = subjects.map(subject => {
            const existing = subjectProgress.find(p => p.name === subjectNames[subject]);
            if (existing) return existing;
            return {
                name: subjectNames[subject],
                value: 0,
                total: 0,
                completed: 0
            };
        });

        const data = displayData;

        return (
            <div style={{ marginTop: '20px' }}>
                <h3>📊 学科学习进度</h3>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '40px',
                    marginTop: '20px'
                }}>
                    {data.map((item) => (
                        <div key={item.name} style={{ textAlign: 'center', width: '220px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '10px' }}>
                                {item.name}
                            </div>
                            <ResponsiveContainer width={200} height={200}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: '已完成', value: item.completed },
                                            { name: '未完成', value: Math.max(0, item.total - item.completed) }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={75}
                                        dataKey="value"
                                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                    >
                                        <Cell fill="#52c41a" />
                                        <Cell fill="#e8e8e8" />
                                    </Pie>
                                    <Tooltip formatter={(value) => `${value} 个专题`} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ marginTop: '10px', fontSize: '13px' }}>
                                已完成: {item.completed} / {item.total}
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                                {item.value}%
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // 折线图渲染
    const renderTrendChart = () => {
        if (scoreTrend.length === 0) {
            return <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>暂无成绩数据，请先完成学生版测验</div>;
        }
        
        return (
            <div style={{ marginTop: '20px' }}>
                <h3>📈 成绩趋势</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={scoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} interval={0} fontSize={10} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="score" stroke="#1890ff" name="成绩" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    };

    // 雷达图渲染
    const renderRadarChart = () => {
        return (
            <div style={{ marginTop: '20px' }}>
                <h3>🎯 知识点掌握度</h3>
                <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={knowledgeMastery}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar name="掌握度" dataKey="value" stroke="#1890ff" fill="#1890ff" fillOpacity={0.6} />
                        <Tooltip />
                        <Legend />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    // 柱状图渲染
    const renderBarChart = () => {
        return (
            <div style={{ marginTop: '20px' }}>
                <h3>⏰ 近7日学习时长</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailyStudyTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis label={{ value: '分钟', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => `${value} 分钟`} />
                        <Bar dataKey="minutes" fill="#52c41a" name="学习时长" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const tabs = [
        { key: 'progress', label: '学习进度', icon: '📊' },
        { key: 'trend', label: '成绩趋势', icon: '📈' },
        { key: 'knowledge', label: '知识点雷达', icon: '🎯' },
        { key: 'time', label: '学习时长', icon: '⏰' }
    ];

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <h1>📊 学习统计</h1>
            
            {/* Tab 切换 */}
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

            {/* 内容区域 */}
            <div style={{
                background: '#fafafa',
                borderRadius: '12px',
                padding: '24px',
                minHeight: '450px'
            }}>
                {activeTab === 'progress' && renderProgressChart()}
                {activeTab === 'trend' && renderTrendChart()}
                {activeTab === 'knowledge' && renderRadarChart()}
                {activeTab === 'time' && renderBarChart()}
            </div>

            {/* 提示信息 */}
            <div style={{
                marginTop: '24px',
                padding: '12px',
                background: '#e6f7ff',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#666'
            }}>
                💡 提示：成绩趋势来自学生版测验的OCR识别结果。学习时长数据正在收集中。
            </div>
        </div>
    );
}

export default LearningStats;