import { useState, useEffect, useRef } from 'react';

/**
 * 学习计时器组件
 * - 进入系统自动开始计时
 * - 显示当日累计学习时长（HH:MM:SS），刷新不归零
 * - 每秒更新显示，每15秒自动保存到 localStorage
 * - 存储格式：study_YYYY-MM-DD = 累计秒数
 */
function StudyTimer() {
    const [display, setDisplay] = useState('00:00');
    const savedSecondsRef = useRef(0);   // 今日之前已保存的秒数
    const sessionStartRef = useRef(0);   // 本次 session 开始的 Date.now()

    useEffect(() => {
        const getTodayKey = () => {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            return `study_${yyyy}-${mm}-${dd}`;
        };

        const getTodaySeconds = () => {
            const key = getTodayKey();
            return parseInt(localStorage.getItem(key) || '0', 10);
        };

        // 读取今日已保存的累计秒数
        savedSecondsRef.current = getTodaySeconds();

        // 用 localStorage 记录本次 session 起始时间（刷新后可恢复）
        const lsSessionKey = 'study_session_start_ts';
        const existingStart = localStorage.getItem(lsSessionKey);
        if (existingStart && (Date.now() - parseInt(existingStart, 10)) < 86400000) {
            // 24小时内的 session 起始时间有效
            sessionStartRef.current = parseInt(existingStart, 10);
        } else {
            sessionStartRef.current = Date.now();
            localStorage.setItem(lsSessionKey, String(sessionStartRef.current));
        }

        // 立即保存一次当前累计值（进入时即有数据，避免学习时长图空白）
        const saveNow = () => {
            const sessionSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
            const total = savedSecondsRef.current + sessionSec;
            localStorage.setItem(getTodayKey(), String(total));
        };
        saveNow();

        // 每秒更新显示（当日累计 = 已保存秒数 + 本次session秒数）
        const timer = setInterval(() => {
            const sessionSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
            const totalSec = savedSecondsRef.current + sessionSec;
            setDisplay(formatTime(totalSec));
        }, 1000);

        // 每15秒自动保存
        const autoSave = setInterval(saveNow, 15000);

        // 页面关闭/刷新时保存
        const handleBeforeUnload = () => {
            saveNow();
        };

        // 页面可见性变化时保存（切标签页回来、最小化恢复等）
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // 重新读取已保存值（可能其他标签页更新了）
                savedSecondsRef.current = getTodaySeconds();
                // 如果跨天了，重置 session
                const key = getTodayKey();
                if (!localStorage.getItem(key)) {
                    savedSecondsRef.current = 0;
                    sessionStartRef.current = Date.now();
                    localStorage.setItem('study_session_start_ts', String(sessionStartRef.current));
                }
            } else {
                saveNow();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(timer);
            clearInterval(autoSave);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            saveNow();
        };
    }, []);

    const formatTime = (totalSeconds) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const pad = (n) => String(n).padStart(2, '0');
        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.15)',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'monospace',
                letterSpacing: '1px',
                userSelect: 'none',
                cursor: 'default'
            }}
            title="今日累计学习时长"
        >
            <span style={{ fontSize: '14px' }}>⏱️</span>
            <span>{display}</span>
        </div>
    );
}

export default StudyTimer;