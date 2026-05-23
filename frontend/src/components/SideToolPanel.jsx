import { useState, useEffect } from 'react';

function SideToolPanel({ isOpen, onClose }) {
    const [notes, setNotes] = useState(() => {
        return localStorage.getItem('study_notes') || '';
    });
    const [calculatorValue, setCalculatorValue] = useState('0');
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // 倒计时状态
    const [daysLeft, setDaysLeft] = useState(null);
    const [examDate, setExamDate] = useState(null);
    const [isUrgent, setIsUrgent] = useState(false);

    // 保存便签
    useEffect(() => {
        localStorage.setItem('study_notes', notes);
    }, [notes]);

    // 计算倒计时
    useEffect(() => {
        const calculateDaysLeft = () => {
            const storedDate = localStorage.getItem('exam_date');
            console.log('读取到的考试日期:', storedDate);

            if (!storedDate) {
                console.log('未设置考试日期');
                setDaysLeft(null);
                setExamDate(null);
                return;
            }

            setExamDate(storedDate);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const targetDate = new Date(storedDate);
            targetDate.setHours(0, 0, 0, 0);

            console.log('今天:', today);
            console.log('目标日期:', targetDate);

            const diffTime = targetDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            console.log('剩余天数:', diffDays);

            setDaysLeft(diffDays);
            setIsUrgent(diffDays <= 30 && diffDays > 0);
        };

        calculateDaysLeft();

        // 监听 storage 变化
        const handleStorageChange = (e) => {
            console.log('storage 变化:', e.key, e.newValue);
            if (e.key === 'exam_date') {
                calculateDaysLeft();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // 日历生成
    const getCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];
        
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(i);
        }
        return days;
    };

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    const handleCalculator = (value) => {
        if (value === 'C') {
            setCalculatorValue('0');
        } else if (value === '=') {
            try {
                const result = new Function('return ' + calculatorValue)();
                setCalculatorValue(String(result));
            } catch (e) {
                setCalculatorValue('错误');
            }
        } else {
            setCalculatorValue(prev => prev === '0' ? value : prev + value);
        }
    };

    const calcButtonStyle = {
        padding: '10px',
        fontSize: '14px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        background: '#fff',
        border: '1px solid #ddd',
        transition: 'all 0.2s'
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '320px',
            height: '100vh',
            background: 'white',
            boxShadow: '2px 0 12px rgba(0,0,0,0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            transition: 'transform 0.3s ease'
        }}>
            {/* 头部 */}
            <div style={{
                padding: '20px',
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                color: 'white'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                            src="/logo.png" 
                            alt="AI伴学" 
                            style={{ height: '28px', width: 'auto' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <h2 style={{ margin: 0, fontSize: '18px' }}>AI 伴学</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>×</button>
                </div>
                <p style={{ margin: '12px 0 0', fontSize: '12px', opacity: 0.9 }}>
                    不设围墙的课堂，不被定义的学习
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.7 }}>
                    For self-learners, lifelong explorers, home educators
                </p>
            </div>

            {/* 🔥 倒计时卡片（新增） */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid #f0f0f0',
                background: daysLeft === null ? '#fafafa' : (daysLeft < 0 ? '#f6ffed' : (isUrgent ? '#fff7e6' : '#e6f7ff'))
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>⏰</span>
                    <h4 style={{ margin: 0 }}>春考倒计时</h4>
                </div>
                
                {daysLeft === null ? (
                    <div style={{ textAlign: 'center', padding: '12px' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#999' }}>--</div>
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            请点击 ⚙️ 设置考试日期
                        </div>
                    </div>
                ) : daysLeft < 0 ? (
                    <div style={{ textAlign: 'center', padding: '8px' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#52c41a' }}>已结束</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>考试日期：{examDate}</div>
                    </div>
                ) : daysLeft === 0 ? (
                    <div style={{ textAlign: 'center', padding: '8px' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff4d4f' }}>就是今天！</div>
                        <div style={{ fontSize: '12px', color: '#ff9800' }}>加油！💪</div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '8px' }}>
                        <div style={{
                            fontSize: '36px',
                            fontWeight: 'bold',
                            color: isUrgent ? '#ff4d4f' : '#1890ff'
                        }}>
                            {daysLeft}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>天</div>
                        {isUrgent && (
                            <div style={{
                                fontSize: '11px',
                                color: '#ff9800',
                                marginTop: '6px',
                                padding: '4px 8px',
                                background: '#fff7e6',
                                borderRadius: '4px'
                            }}>
                                ⚠️ 冲刺阶段，加油！
                            </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                            目标：{examDate}
                        </div>
                    </div>
                )}
            </div>

            {/* 日历 */}
            <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
                <h4 style={{ margin: '0 0 12px 0' }}>📅 学习日历</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <button 
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} 
                        style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '16px' }}
                    >
                        ◀
                    </button>
                    <span style={{ fontWeight: 'bold' }}>{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</span>
                    <button 
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} 
                        style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '16px' }}
                    >
                        ▶
                    </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '12px', marginBottom: '8px' }}>
                    {weekDays.map(day => <div key={day} style={{ color: '#999' }}>{day}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                    {getCalendarDays().map((day, idx) => {
                        const isToday = day === new Date().getDate() && 
                                       currentDate.getMonth() === new Date().getMonth() &&
                                       currentDate.getFullYear() === new Date().getFullYear();
                        return (
                            <div key={idx} style={{
                                padding: '6px',
                                fontSize: '12px',
                                borderRadius: '4px',
                                background: isToday ? '#1890ff' : 'transparent',
                                color: isToday ? 'white' : '#333'
                            }}>
                                {day || ''}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 便签 */}
            <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
                <h4 style={{ margin: '0 0 8px 0' }}>📝 学习便签</h4>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="记录今天的待办事项..."
                    rows={4}
                    style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        resize: 'vertical',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit'
                    }}
                />
            </div>

            {/* 计算器 */}
            <div style={{ padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0' }}>🧮 计算器</h4>
                <div style={{
                    background: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    textAlign: 'right',
                    fontSize: '20px',
                    fontFamily: 'monospace',
                    minHeight: '50px',
                    wordBreak: 'break-all'
                }}>
                    {calculatorValue}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {['7', '8', '9', '/'].map(btn => (
                        <button key={btn} onClick={() => handleCalculator(btn)} style={calcButtonStyle}>{btn}</button>
                    ))}
                    {['4', '5', '6', '*'].map(btn => (
                        <button key={btn} onClick={() => handleCalculator(btn)} style={calcButtonStyle}>{btn}</button>
                    ))}
                    {['1', '2', '3', '-'].map(btn => (
                        <button key={btn} onClick={() => handleCalculator(btn)} style={calcButtonStyle}>{btn}</button>
                    ))}
                    {['0', '.', '=', '+'].map(btn => (
                        <button key={btn} onClick={() => handleCalculator(btn)} style={calcButtonStyle}>{btn}</button>
                    ))}
                    {['C'].map(btn => (
                        <button key={btn} onClick={() => handleCalculator(btn)} style={{ ...calcButtonStyle, background: '#ff4d4f', color: 'white' }}>{btn}</button>
                    ))}
                </div>
            </div>

            {/* 底部提示 */}
            <div style={{
                padding: '12px',
                textAlign: 'center',
                fontSize: '11px',
                color: '#999',
                borderTop: '1px solid #f0f0f0',
                marginTop: 'auto'
            }}>
                💡 学习工具 · 伴你成长
            </div>
        </div>
    );
}

export default SideToolPanel;