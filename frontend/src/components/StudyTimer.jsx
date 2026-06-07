import { useState, useEffect, useRef } from 'react';

/**
 * 学习计时器组件
 * - 进入系统自动开始计时，离开系统停止
 * - 显示当日累计学习时长（HH:MM:SS），刷新不归零
 * - 每秒更新显示，每15秒自动保存到 localStorage
 * - 存储格式：study_YYYY-MM-DD = 累计秒数
 *
 * 核心原则：
 * - 每次页面加载/刷新 = 新的 session，从 0 开始计本次 session 时长
 * - 当日累计 = localStorage 中已保存的秒数 + 本次 session 秒数
 * - 跨天时：只计算属于当天的部分，昨天的时间不会带入今天
 * - 一天最多 86400 秒（24小时），超过即为脏数据，自动清零
 */
function StudyTimer() {
    const [display, setDisplay] = useState('00:00');
    const savedSecondsRef = useRef(0);   // 今日已保存到 localStorage 的秒数
    const sessionStartRef = useRef(0);   // 本次 session 的 Date.now()（页面加载时间）
    const sessionDateRef = useRef('');   // 本次 session 启动时的日期

    useEffect(() => {
        const getTodayStr = () => {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        const getTodayKey = () => `study_${getTodayStr()}`;

        const MAX_SECONDS_PER_DAY = 86400; // 24小时上限

        // 读取并校验今日已保存的秒数
        const getTodaySeconds = () => {
            const raw = parseInt(localStorage.getItem(getTodayKey()) || '0', 10);
            if (isNaN(raw) || raw < 0 || raw > MAX_SECONDS_PER_DAY) {
                // 脏数据：清零
                console.warn(`[StudyTimer] 检测到脏数据 ${getTodayKey()}=${raw}，已清零`);
                localStorage.setItem(getTodayKey(), '0');
                return 0;
            }
            return raw;
        };

        // 清理旧版残留数据
        localStorage.removeItem('study_session_start_ts');
        // 清理所有 study_ 开头的脏数据（超过24小时的值）
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('study_') && key.length === 15) {
                const val = parseInt(localStorage.getItem(key) || '0', 10);
                if (isNaN(val) || val < 0 || val > MAX_SECONDS_PER_DAY) {
                    console.warn(`[StudyTimer] 清理脏数据 ${key}=${val}`);
                    localStorage.setItem(key, '0');
                }
            }
        }

        // 记录本次 session 开始时间和日期
        sessionStartRef.current = Date.now();
        sessionDateRef.current = getTodayStr();

        // 读取今日已保存的累计秒数
        savedSecondsRef.current = getTodaySeconds();

        // 保存函数：只保存本次 session 中属于当天的秒数
        const saveNow = () => {
            const todayStr = getTodayStr();
            const sessionElapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);

            if (todayStr === sessionDateRef.current) {
                // 同一天：正常累加
                const total = savedSecondsRef.current + sessionElapsed;
                const clamped = Math.min(total, MAX_SECONDS_PER_DAY);
                localStorage.setItem(`study_${todayStr}`, String(clamped));
            } else {
                // 跨天了：今天从 0 开始，只保存今天的部分
                const midnight = new Date();
                midnight.setHours(0, 0, 0, 0);
                const todaySeconds = Math.min(
                    Math.floor((Date.now() - midnight.getTime()) / 1000),
                    MAX_SECONDS_PER_DAY
                );
                localStorage.setItem(`study_${todayStr}`, String(todaySeconds));
                savedSecondsRef.current = todaySeconds;
                sessionStartRef.current = Date.now();
                sessionDateRef.current = todayStr;
            }
        };

        // 立即保存一次（避免学习时长图空白）
        saveNow();

        // 每秒更新显示
        const timer = setInterval(() => {
            const todayStr = getTodayStr();
            const sessionElapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);

            let totalSec;
            if (todayStr === sessionDateRef.current) {
                totalSec = Math.min(savedSecondsRef.current + sessionElapsed, MAX_SECONDS_PER_DAY);
            } else {
                // 跨天：只显示今天零点后的秒数
                const midnight = new Date();
                midnight.setHours(0, 0, 0, 0);
                totalSec = Math.min(
                    Math.floor((Date.now() - midnight.getTime()) / 1000),
                    MAX_SECONDS_PER_DAY
                );
            }
            setDisplay(formatTime(totalSec));
        }, 1000);

        // 每15秒自动保存
        const autoSave = setInterval(saveNow, 15000);

        // 页面关闭/刷新时保存
        const handleBeforeUnload = () => {
            saveNow();
        };

        // 页面可见性变化：回来时刷新已保存值，离开时保存
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // 重新读取已保存值（可能其他标签页更新了）
                savedSecondsRef.current = getTodaySeconds();
                // 重置 session 起始（避免切出去很久回来后累加不合理的时长）
                sessionStartRef.current = Date.now();
                sessionDateRef.current = getTodayStr();
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