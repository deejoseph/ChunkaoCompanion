export const DEFAULT_EXAM_DATE = '2027-01-09';
export const EXAM_DATE_STORAGE_KEY = 'exam_date';
export const EXAM_DATE_CHANGED_EVENT = 'examDateChanged';

export function getExamDate() {
    const stored = localStorage.getItem(EXAM_DATE_STORAGE_KEY);
    if (stored) return stored;
    localStorage.setItem(EXAM_DATE_STORAGE_KEY, DEFAULT_EXAM_DATE);
    return DEFAULT_EXAM_DATE;
}

export function setExamDate(value) {
    if (!value) return;
    localStorage.setItem(EXAM_DATE_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent(EXAM_DATE_CHANGED_EVENT, { detail: value }));
}

/** 按本地时区解析 YYYY-MM-DD，避免 UTC 偏移导致差一天 */
export function parseExamDateLocal(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function daysUntilExam(dateStr = getExamDate()) {
    const target = parseExamDateLocal(dateStr);
    if (!target) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}
