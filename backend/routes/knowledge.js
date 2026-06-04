const { execFile } = require('child_process');
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PYTHON = process.env.PYTHON_PATH || process.env.WHISPER_PYTHON_PATH || 'python';
const INIT_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/init_knowledge_db.py');
const QUERY_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/query_knowledge_db.py');
const IMPORT_BANKS_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/import_question_banks.py');
const LINK_QUESTION_KNOWLEDGE_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/link_question_knowledge.py');
const REBUILD_KNOWLEDGE_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/rebuild_knowledge_from_json.py');
const upload = multer({ dest: path.join(PROJECT_ROOT, 'temp_uploads') });

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

router.get('/graph', async (req, res) => {
    const subject = String(req.query.subject || 'all').toLowerCase();
    const subjects = subject === 'all' ? ['chinese', 'math', 'english'] : [subject];

    try {
        const db = await open({
            filename: path.join(PROJECT_ROOT, 'data/knowledge/chunkao.db'),
            driver: sqlite3.Database
        });

        const subjectNames = { chinese: '语文', math: '数学', english: '英语' };
        const result = {};

        for (const item of subjects) {
            const rows = await db.all(`
                SELECT
                    kp.id AS knowledge_point_id,
                    kp.name,
                    COALESCE(kp.category, '未分类') AS category,
                    COUNT(DISTINCT q.id) AS question_count,
                    ROUND(AVG(qkp.confidence), 2) AS avg_confidence,
                    ROUND(SUM(qkp.confidence), 2) AS support_weight
                FROM question_knowledge_points qkp
                JOIN questions q ON q.id = qkp.question_id
                JOIN question_banks qb ON qb.id = q.bank_id
                JOIN knowledge_points kp ON kp.id = qkp.knowledge_point_id
                WHERE qb.subject_id = ?
                GROUP BY kp.id
                ORDER BY support_weight DESC, question_count DESC
            `, [item]);

            const totalQuestions = rows.reduce((sum, row) => sum + Number(row.question_count || 0), 0);
            const categoryMap = new Map();

            rows.forEach(row => {
                const category = String(row.category || '未分类');
                if (!categoryMap.has(category)) {
                    categoryMap.set(category, []);
                }
                categoryMap.get(category).push({
                    name: row.name,
                    value: Number(row.question_count || 0),
                    support: Number(row.support_weight || 0),
                    confidence: Number(row.avg_confidence || 0),
                    id: row.knowledge_point_id
                });
            });

            const tree = {
                name: subjectNames[item] || item,
                value: totalQuestions,
                children: Array.from(categoryMap.entries()).map(([category, children]) => ({
                    name: category,
                    value: children.reduce((sum, child) => sum + child.value, 0),
                    children: children.map(child => ({
                        name: child.name,
                        value: child.value,
                        support: child.support,
                        confidence: child.confidence,
                        id: child.id
                    }))
                }))
            };

            result[item] = {
                subject: item,
                subjectName: subjectNames[item] || item,
                summary: {
                    totalKnowledgePoints: rows.length,
                    totalQuestionLinks: totalQuestions
                },
                tree,
                support: rows.slice(0, 18).map(row => ({
                    name: row.name,
                    support: Number(row.question_count || 0),
                    confidence: Number(row.avg_confidence || 0),
                    weight: Number(row.support_weight || 0)
                }))
            };
        }

        await db.close();

        res.json({
            success: true,
            data: subject === 'all' ? result : result[subject]
        });
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

// 上传单个知识点 JSON，写入树状知识图谱相关表。
router.post('/import-json', upload.single('file'), async (req, res) => {
    const file = req.file;
    const subject = req.body?.subject || 'chinese';
    const version = req.body?.version || '2026';
    const clearExisting = req.body?.clearExisting === 'true' || req.body?.clearExisting === true;

    if (!file) {
        return res.status(400).json({ success: false, error: 'No JSON file uploaded' });
    }

    try {
        let preferredName = file.originalname || 'knowledge.json';
        try {
            const uploadedJson = JSON.parse(fs.readFileSync(file.path, 'utf-8'));
            if (uploadedJson?.专题 && !String(preferredName).includes(uploadedJson.专题)) {
                preferredName = `专题00 ${uploadedJson.专题}.json`;
            }
        } catch (parseError) {
            // Let the Python importer return the final JSON parse error.
        }

        const safeOriginalName = String(preferredName)
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
        const importPath = path.join(path.dirname(file.path), safeOriginalName);
        if (fs.existsSync(importPath)) fs.unlinkSync(importPath);
        fs.renameSync(file.path, importPath);
        file.path = importPath;

        const result = await runPython(REBUILD_KNOWLEDGE_SCRIPT, [
            '--version', version,
            '--subject', subject,
            '--input-files', file.path,
            ...(clearExisting ? ['--clear-existing'] : [])
        ]);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr
        });
    } finally {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
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

// 保存知识点 JSON（前端校对后调用）
router.post('/save', async (req, res) => {
    const payload = req.body || {};
    const subject = payload.subject || 'chinese';
    const version = payload.version || '2026';
    const topicTitle = payload.topicTitle || payload.title || '';
    const json = payload.json || payload.knowledge || {};

    if (!topicTitle || !json) {
        res.status(400).json({ success: false, error: '缺少 topicTitle 或 json 字段' });
        return;
    }

    try {
        const db = await open({ filename: path.join(__dirname, '../../data/knowledge/chunkao.db'), driver: sqlite3.Database });
        const now = new Date().toISOString();

        // upsert topic
        const topicId = `${subject}_${version}_${topicTitle}`.replace(/\s+/g, '_').slice(0, 120);
        await db.run(`INSERT INTO topics(id, subject_id, version_id, code, title, source_dir, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at`,
            [topicId, subject, version, null, topicTitle, '', now, now]
        );

        // upsert knowledge points and link to topic
        const knowledgePoints = Array.isArray(json.knowledgePoints) ? json.knowledgePoints : (json.knowledge_points || []);
        for (const kp of knowledgePoints) {
            const name = (kp.name || kp.title || '').trim();
            if (!name) continue;
            const kpId = `${subject}_${name}`.replace(/\s+/g, '_').slice(0, 120);
            await db.run(`INSERT INTO knowledge_points(id, subject_id, name, category, description, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(subject_id, name) DO UPDATE SET updated_at=excluded.updated_at`,
                [kpId, subject, name, kp.category || kp.type || '', kp.description || '', now, now]
            );

            await db.run(`INSERT OR REPLACE INTO topic_knowledge_points(topic_id, knowledge_point_id, confidence, source)
                VALUES(?, ?, ?, ?)
            `, [topicId, kpId, kp.confidence || 0.8, 'ai-draft']);
        }

        await db.close();
        res.json({ success: true, topicId });
    } catch (error) {
        console.error('保存知识点失败:', error);
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
