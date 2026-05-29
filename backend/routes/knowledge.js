const { execFile } = require('child_process');
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PYTHON = process.env.PYTHON_PATH || process.env.WHISPER_PYTHON_PATH || 'python';
const INIT_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/init_knowledge_db.py');
const QUERY_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/query_knowledge_db.py');
const IMPORT_BANKS_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/import_question_banks.py');
const LINK_QUESTION_KNOWLEDGE_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/link_question_knowledge.py');

function normalizeTitle(title = '') {
    return String(title)
        .replace(/\.pdf$/i, '')
        .replace(/（教师版）|（学生版）|（AI参考答案）/g, '')
        .replace(/\(教师版\)|\(学生版\)|\(AI参考答案\)/g, '')
        .replace(/（复习讲义）|（上海专用）/g, '')
        .replace(/\s+/g, '')
        .trim();
}

function runPython(script, args = []) {
    return new Promise((resolve, reject) => {
        execFile(PYTHON, [script, ...args], {
            cwd: PROJECT_ROOT,
            maxBuffer: 20 * 1024 * 1024,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8'
            }
        }, (error, stdout, stderr) => {
            if (error) {
                error.stderr = stderr;
                reject(error);
                return;
            }

            try {
                resolve(JSON.parse(stdout));
            } catch (parseError) {
                parseError.stdout = stdout;
                parseError.stderr = stderr;
                reject(parseError);
            }
        });
    });
}

router.post('/init', async (req, res) => {
    try {
        const scan = req.body?.scan !== false;
        const result = await runPython(INIT_SCRIPT, scan ? ['--scan'] : []);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr
        });
    }
});

router.get('/summary', async (req, res) => {
    try {
        const result = await runPython(QUERY_SCRIPT, ['summary']);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/topics', async (req, res) => {
    try {
        const args = ['topics'];
        if (req.query.subject) args.push('--subject', req.query.subject);
        if (req.query.version) args.push('--version', req.query.version);
        const result = await runPython(QUERY_SCRIPT, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/points', async (req, res) => {
    try {
        const args = ['knowledge-points'];
        if (req.query.subject) args.push('--subject', req.query.subject);
        const result = await runPython(QUERY_SCRIPT, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/banks', async (req, res) => {
    try {
        const args = ['banks'];
        if (req.query.subject) args.push('--subject', req.query.subject);
        if (req.query.version) args.push('--version', req.query.version);
        if (req.query.limit) args.push('--limit', req.query.limit);
        const result = await runPython(QUERY_SCRIPT, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/import-question-banks', async (req, res) => {
    try {
        const result = await runPython(IMPORT_BANKS_SCRIPT);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr
        });
    }
});

router.post('/link-question-knowledge', async (req, res) => {
    try {
        const args = [];
        if (req.body?.subject) args.push('--subject', req.body.subject);
        if (req.body?.reset) args.push('--reset');
        const result = await runPython(LINK_QUESTION_KNOWLEDGE_SCRIPT, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr
        });
    }
});

router.get('/questions', async (req, res) => {
    try {
        const args = ['questions'];
        if (req.query.subject) args.push('--subject', req.query.subject);
        if (req.query.bankId) args.push('--bank-id', req.query.bankId);
        if (req.query.limit) args.push('--limit', req.query.limit);
        const result = await runPython(QUERY_SCRIPT, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取专题下所有题目的原答案（用于 AI 参考答案中的参考资料）
router.get('/source-answers', async (req, res) => {
    const { subject, title } = req.query;
    
    console.log('收到 source-answers 请求:', { subject, title });
    
    try {
        const db = await open({
            filename: path.join(__dirname, '../../data/knowledge/chunkao.db'),
            driver: sqlite3.Database
        });
        
        // 清理标题
        let cleanTitle = title || '';
        cleanTitle = cleanTitle.replace(/（教师版）/, '');
        cleanTitle = cleanTitle.replace(/（学生版）/, '');
        cleanTitle = cleanTitle.replace(/（复习讲义）/, '');
        cleanTitle = cleanTitle.replace(/（上海专用）/, '');
        cleanTitle = cleanTitle.replace(/\(教师版\)/, '');
        cleanTitle = cleanTitle.replace(/\(学生版\)/, '');
        cleanTitle = cleanTitle.trim();
        
        console.log('清理后的标题:', cleanTitle);
        
        // 查找匹配的题库。这里用 JS 规范化比较，兼容教师版/学生版/复习讲义等后缀差异。
        const candidates = await db.all(
            `SELECT id, title, source_title FROM question_banks
             WHERE subject_id = ?
             ORDER BY updated_at DESC`,
            [subject]
        );
        const normalizedTitle = normalizeTitle(cleanTitle);
        const bank = candidates.find(candidate => {
            const titleKey = normalizeTitle(candidate.title);
            const sourceKey = normalizeTitle(candidate.source_title);
            return titleKey === normalizedTitle
                || sourceKey === normalizedTitle
                || titleKey.includes(normalizedTitle)
                || normalizedTitle.includes(titleKey)
                || sourceKey.includes(normalizedTitle)
                || normalizedTitle.includes(sourceKey);
        });
        
        console.log('找到的题库:', bank);
        
        let answers = [];
        let bankId = null;
        if (bank) {
            bankId = bank.id;
            answers = await db.all(
                `SELECT number, source_answer FROM questions 
                 WHERE bank_id = ? 
                 ORDER BY number ASC`,
                [bank.id]
            );
            console.log('找到的答案数量:', answers.length);
        }
        
        await db.close();
        
        res.json({ success: true, bankId, answers: answers });
    } catch (error) {
        console.error('获取原答案失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
