import { useState, useEffect } from 'react';

function SideToolPanel({ isOpen, onClose }) {
    const [notes, setNotes] = useState(() => {
        return localStorage.getItem('study_notes') || '';
    });
    const [calculatorValue, setCalculatorValue] = useState('0');
    const [currentDate, setCurrentDate] = useState(new Date());

    // 保存便签
    useEffect(() => {
        localStorage.setItem('study_notes', notes);
    }, [notes]);

    // 日历生成
    const getCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];
        
        // 填充空白
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }
        // 填充日期
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(i);
        }
        return days;
    };

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // 计算器
    const handleCalculator = (value) => {
        if (value === 'C') {
            setCalculatorValue('0');
        } else if (value === '=') {
            try {
                // 使用 Function 代替 eval 更安全
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