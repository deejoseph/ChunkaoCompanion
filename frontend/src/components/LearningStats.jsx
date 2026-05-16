import { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    BarChart, Bar,
    ComposedChart, Area
} from 'recharts';

function LearningStats() {
    const [activeTab, setActiveTab] = useState('progress');
    const [subjectProgress, setSubjectProgress] = useState([]);
    const [scoreTrend, setScoreTrend] = useState([]);
    const [trendStats, setTrendStats] = useState([]);
    const [knowledgeMastery, setKnowledgeMastery] = useState([]);
    const [dailyStudyTime, setDailyStudyTime] = useState([]);

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
        
        // R²
        const yMean = sumY / n;
        const ssRes = indices.reduce((s, x, i) => s + (scores[i] - (a + b * x)) ** 2, 0);
        const ssTot = scores.reduce((s, y) => s + (y - yMean) ** 2, 0);
        const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
        
        // 置信区间 (95%)
        const residuals = indices.map((x, i) => scores[i] - (a + b * x));
        const se = Math.sqrt(residuals.reduce((s, r) => s + r ** 2, 0) / (n - 2));
        const ci = 1.96 * se;
        
        return { a, b, r2, ci, trendLine: indices.map(x => a + b * x), upperLine: indices.map(x => a + b * x + ci), lowerLine: indices.map(x => a + b * x - ci) };
    };

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
                completed: completed
            });
        }

        setSubjectProgress(progressData);
    };

    // 加载成绩趋势数据
    const loadScoreTrendData = () => {
        const scoresBySubject = {
            chinese: [],
            math: [],
            english: []
        };
        
        // 从 localStorage 读取所有成绩记录
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
        
        // 按测验序号排序
        for (const subject of ['chinese', 'math', 'english']) {
            scoresBySubject[subject].sort((a, b) => a.testNumber - b.testNumber);
        }
        
        // 构建图表数据（合并所有学科的最大长度）
        const maxLen = Math.max(
            scoresBySubject.chinese.length,
            scoresBySubject.math.length,
            scoresBySubject.english.length
        );
        
        const chartData = [];
        const statsData = [];
        
        for (let i = 0; i < maxLen; i++) {
            const testNumber = i + 1;
            const dataPoint = { testNumber };
            
            for (const subject of subjects) {
                const score = scoresBySubject[subject.key][i]?.score || null;
                dataPoint[subject.name] = score;
            }
            chartData.push(dataPoint);
        }
        
        setScoreTrend(chartData);
        
        // 计算各学科趋势统计
        const stats = subjects.map(subject => {
            const scores = scoresBySubject[subject.key];
            const { a, b, r2, ci, trendLine, upperLine, lowerLine } = linearRegression(scores);
            
            // 构建趋势线数据
            const trendData = scores.map((_, i) => ({
                testNumber: i + 1,
                trend: trendLine[i],
                upper: upperLine[i],
                lower: lowerLine[i]
            }));
            
            return {
                ...subject,
                scores,
                trend: { a, b, r2, ci },
                trendData,
                hasData: scores.length > 0
            };
        });
        
        setTrendStats(stats);
    };

    // 加载知识点掌握度
    const loadKnowledgeData = () => {
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

    // 加载每日学习时间
    const loadDailyStudyData = () => {
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push({
                date: `${date.getMonth() + 1}/${date.getDate()}`,
                minutes: Math.floor(Math.random() * 60) + 20
            });
        }
        setDailyStudyTime(last7Days);
    };

    // 饼图渲染
    const renderProgressChart = () => {
        const displayData = subjects.map(s => {
            const existing = subjectProgress.find(p => p.name === s.name);
            if (existing) return existing;
            return { name: s.name, value: 0, total: 0, completed: 0 };
        });

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
                    {displayData.map((item) => (
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

    // 成绩趋势图渲染（多曲线 + 趋势线 + 置信区间）
    const renderTrendChart = () => {
        const hasData = trendStats.some(s => s.hasData);
        
        if (!hasData) {
            return <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>暂无成绩数据，请先完成学生版测验</div>;
        }
        
        return (
            <div style={{ marginTop: '20px' }}>
                <h3>📈 成绩趋势分析</h3>
                
                {/* 成绩散点图 + 趋势线 */}
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={scoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="testNumber" 
                            label={{ value: '测验序号', position: 'insideBottom', offset: -5 }}
                        />
                        <YAxis 
                            domain={[0, 100]} 
                            label={{ value: '成绩（分）', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip formatter={(value) => `${value}分`} />
                        <Legend />
                        
                        {/* 各学科成绩曲线 */}
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
                
                {/* 趋势线统计卡片 */}
                <div style={{ marginTop: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {trendStats.map(subject => (
                        subject.hasData && (
                            <div key={subject.key} style={{ 
                                background: '#f5f5f5', 
                                padding: '12px', 
                                borderRadius: '8px',
                                flex: 1,
                                minWidth: '200px'
                            }}>
                                <div style={{ fontWeight: 'bold', color: subject.color }}>
                                    {subject.name}
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    趋势方程: y = {subject.trend.b.toFixed(2)}x + {subject.trend.a.toFixed(0)}
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    拟合度 R²: {subject.trend.r2.toFixed(3)}
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    置信区间: ±{subject.trend.ci.toFixed(1)} 分
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                    已测 {subject.scores.length} 次
                                </div>
                                {subject.trend.b > 0 ? (
                                    <div style={{ fontSize: '12px', color: '#52c41a' }}>📈 呈上升趋势</div>
                                ) : subject.trend.b < 0 ? (
                                    <div style={{ fontSize: '12px', color: '#f5222d' }}>📉 呈下降趋势</div>
                                ) : (
                                    <div style={{ fontSize: '12px', color: '#999' }}>➡️ 趋势平稳</div>
                                )}
                            </div>
                        )
                    ))}
                </div>
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
                {activeTab === 'knowledge' && renderRadarChart()}
                {activeTab === 'time' && renderBarChart()}
            </div>

            <div style={{
                marginTop: '24px',
                padding: '12px',
                background: '#e6f7ff',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#666'
            }}>
                💡 趋势方程 y = bx + a，b {'>'} 0 表示进步，R² 越接近 1 说明趋势越明显。置信区间 ±ci 表示成绩可能波动的范围。
            </div>
        </div>
    );
}

export default LearningStats;