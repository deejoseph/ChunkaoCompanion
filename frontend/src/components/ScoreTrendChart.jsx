import { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ComposedChart, Area, ResponsiveContainer
} from 'recharts';

const subjects = [
    { key: 'chinese', name: '语文', color: '#52c41a' },
    { key: 'math', name: '数学', color: '#1890ff' },
    { key: 'english', name: '英语', color: '#fa8c16' }
];

// 线性回归计算
function linearRegression(data) {
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
    
    // 置信区间
    const residuals = indices.map((x, i) => scores[i] - (a + b * x));
    const se = Math.sqrt(residuals.reduce((s, r) => s + r ** 2, 0) / (n - 2));
    const ci = 1.96 * se;
    
    return { a, b, r2, ci };
}

function ScoreTrendChart() {
    const [subjectData, setSubjectData] = useState([]);
    const [allData, setAllData] = useState([]);

    useEffect(() => {
        loadScoreData();
    }, []);

    const loadScoreData = () => {
        // 从 localStorage 读取所有测验成绩
        const scoresBySubject = {
            chinese: [],
            math: [],
            english: []
        };
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('score_')) {
                try {
                    const score = JSON.parse(localStorage.getItem(key));
                    scoresBySubject[score.subject].push({
                        testNumber: score.testNumber,
                        score: score.score,
                        timestamp: score.timestamp
                    });
                } catch (e) {}
            }
        }
        
        // 按测验序号排序
        for (const subject of subjects) {
            scoresBySubject[subject.key].sort((a, b) => a.testNumber - b.testNumber);
        }
        
        // 构建图表数据（合并所有学科的最大长度）
        const maxLen = Math.max(
            scoresBySubject.chinese.length,
            scoresBySubject.math.length,
            scoresBySubject.english.length
        );
        
        const chartData = [];
        for (let i = 0; i < maxLen; i++) {
            chartData.push({
                testNumber: i + 1,
                chinese: scoresBySubject.chinese[i]?.score || null,
                math: scoresBySubject.math[i]?.score || null,
                english: scoresBySubject.english[i]?.score || null
            });
        }
        
        setAllData(chartData);
        
        // 计算各学科趋势线
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
        
        setSubjectData(stats);
    };

    return (
        <div>
            <h3>📈 成绩趋势分析</h3>
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={allData}>
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
                    
                    {subjects.map(subject => (
                        <Line
                            key={subject.key}
                            type="monotone"
                            dataKey={subject.key}
                            name={subject.name}
                            stroke={subject.color}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
            
            {/* 趋势线统计 */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {subjectData.map(subject => (
                    subject.hasData && (
                        <div key={subject.key} style={{ 
                            background: '#f5f5f5', 
                            padding: '12px', 
                            borderRadius: '8px',
                            flex: 1,
                            minWidth: '180px'
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
                        </div>
                    )
                ))}
            </div>
            
            {subjectData.every(s => !s.hasData) && (
                <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                    暂无成绩数据，请先完成学生版测验
                </div>
            )}
        </div>
    );
}

export default ScoreTrendChart;