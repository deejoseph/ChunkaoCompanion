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
const IMPORT_KP_MAPPING_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/import_kp_mapping_from_csv.py');
const EXPORT_DIR = path.join(PROJECT_ROOT, 'data/exports');
const upload = multer({ dest: path.join(PROJECT_ROOT, 'temp_uploads') });

// ─── 文件名编码修复 ────────────────────────────────────────────────────
// multer 默认以 latin1 解码 originalname，中文文件名会变成乱码。
// 此函数将 latin1 字节重新解释为 utf-8，还原中文文件名。
function decodeFilename(originalName) {
    if (!originalName) return originalName;
    try {
        return Buffer.from(originalName, 'latin1').toString('utf8');
    } catch {
        return originalName;
    }
}

// ─── 知识点 JSON 双重防御校验 ────────────────────────────────────────────
// 第一级：文件名必须匹配知识点文件命名规则（以"专题"开头）
function validateKnowledgeFilename(originalName) {
    const baseName = path.basename(originalName || '').replace(/\.json$/i, '');
    if (!baseName.startsWith('专题')) {
        return {
            valid: false,
            reason: `文件名校验失败：知识点文件必须以"专题"开头，当前文件名："${originalName}"。\n` +
                    `请确认上传的是知识点 JSON（data/docs 下的"专题*.json"），而非题库 JSON（data/exams 下的"qwen*.json"）。`
        };
    }
    return { valid: true };
}

// 第二级：JSON 结构必须符合知识点格式（包含 "专题" 字段 + 至少一个核心结构字段）
function validateKnowledgeJsonStructure(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
        return { valid: false, reason: 'JSON 结构校验失败：知识点 JSON 必须是一个对象（Object），不能是数组或基本类型。' };
    }
    const hasZhuanti = typeof json['专题'] === 'string' && json['专题'].trim().length > 0;
    if (!hasZhuanti) {
        // 检查是否误传了题库 JSON
        const looksLikeQuestionBank = !!(
            json.exam_info || json.examInfo ||
            (Array.isArray(json.sections) && json.sections.length > 0) ||
            (Array.isArray(json.questions) && json.questions.length > 0)
        );
        if (looksLikeQuestionBank) {
            return {
                valid: false,
                reason: 'JSON 结构校验失败：该文件看起来是题库 JSON（包含 exam_info/sections/questions），不是知识点 JSON。\n' +
                        '请将此文件上传到"上传 JSON 生成题库"入口。'
            };
        }
        return {
            valid: false,
            reason: 'JSON 结构校验失败：知识点 JSON 必须包含顶层字段 "专题"（字符串类型）。\n' +
                    '合法示例：{ "专题": "名篇名句默写", "命题分析": {...}, "考点体系": {...} }'
        };
    }
    const hasKaodianTixi = json['考点体系'] && typeof json['考点体系'] === 'object';
    const hasMingtiFenxi = json['命题分析'] && typeof json['命题分析'] === 'object';
    if (!hasKaodianTixi && !hasMingtiFenxi) {
        return {
            valid: false,
            reason: 'JSON 结构校验失败：知识点 JSON 必须至少包含 "考点体系" 或 "命题分析" 之一。\n' +
                    `当前仅有字段：${Object.keys(json).join(', ')}`
        };
    }
    return { valid: true };
}

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

router.get('/analysis', async (req, res) => {
    const subject = String(req.query.subject || 'math').toLowerCase();
    const subjectNames = { chinese: '语文', math: '数学', english: '英语' };

    try {
        const db = await open({
            filename: path.join(PROJECT_ROOT, 'data/knowledge/chunkao.db'),
            driver: sqlite3.Database
        });

        const rows = await db.all(`
            WITH base AS (
                SELECT
                    qb.year,
                    qb.subject_id,
                    COALESCE(q.score, 1) AS score,
                    CASE
                        WHEN trim(q.difficulty) != '' AND CAST(q.difficulty AS REAL) IS NOT NULL THEN CAST(q.difficulty AS REAL)
                        -- 当 difficulty 为空时，用题分做先底分级，映射到 1-8 量纲
                        -- 低分题(<=4分)偏基础(2), 中分题(5-6分)中档(5), 高分题(>=7分)压轴(7)
                        WHEN COALESCE(q.score, 1) <= 4 THEN 2
                        WHEN COALESCE(q.score, 1) <= 6 THEN 5
                        ELSE 7
                    END AS difficulty,
                    COALESCE(kp.category, kp.name, '未归类') AS topic
                FROM questions q
                JOIN question_banks qb ON qb.id = q.bank_id
                LEFT JOIN question_knowledge_points qkp ON qkp.question_id = q.id
                LEFT JOIN knowledge_points kp ON kp.id = qkp.knowledge_point_id
                WHERE qb.subject_id = ?
                  AND qb.year BETWEEN 2017 AND 2026
            )
            SELECT
                year,
                topic,
                SUM(score) AS total_score,
                SUM(score * difficulty / 8) AS difficulty_subtotal,
                SUM(CASE
                    WHEN difficulty <= 3 THEN score
                    ELSE 0
                END) AS easy_score,
                SUM(CASE
                    WHEN difficulty >= 4 AND difficulty <= 5 THEN score
                    ELSE 0
                END) AS middle_score,
                SUM(CASE
                    WHEN difficulty >= 6 THEN score
                    ELSE 0
                END) AS hard_score
            FROM base
            GROUP BY year, topic
            ORDER BY year, total_score DESC
        `, [subject]);

        const yearMap = new Map();
        const topicTotals = new Map();
        const difficultyTotals = new Map();

        rows.forEach((row) => {
            const year = Number(row.year);
            const topic = String(row.topic || '未归类');
            const score = Number(row.total_score || 0);
            const difficultySubtotal = Number(row.difficulty_subtotal || 0);

            if (!yearMap.has(year)) yearMap.set(year, new Map());
            yearMap.get(year).set(topic, score);

            topicTotals.set(topic, (topicTotals.get(topic) || 0) + score);

            if (!difficultyTotals.has(year)) difficultyTotals.set(year, { 基础题: 0, 中档题: 0, 压轴难题: 0 });
            difficultyTotals.get(year).基础题 += Number(row.easy_score || 0);
            difficultyTotals.get(year).中档题 += Number(row.middle_score || 0);
            difficultyTotals.get(year).压轴难题 += Number(row.hard_score || 0);
        });

        const years = Array.from(yearMap.keys()).sort((a, b) => a - b);
        const topics = Array.from(topicTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);

        const heatmapData = years.map((year) => {
            const row = { year };
            topics.forEach((topic) => {
                row[topic] = Number((yearMap.get(year).get(topic) || 0).toFixed(1));
            });
            return row;
        });

        const topTopics = topics.map((topic) => ({
            topic,
            total: Number((topicTotals.get(topic) || 0).toFixed(1))
        }));

        const linearRegression = (values) => {
            const n = values.length;
            if (n < 2) return { a: 0, b: 0 };
            const x = values.map((_, i) => i + 1);
            const y = values.map((item) => item.score);
            const sumX = x.reduce((s, v) => s + v, 0);
            const sumY = y.reduce((s, v) => s + v, 0);
            const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
            const sumX2 = x.reduce((s, v) => s + v * v, 0);
            const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const a = (sumY - b * sumX) / n;
            return { a, b };
        };

        const trendSeries = topTopics.map((item) => {
            const values = years.map((year) => ({ year, score: Number((yearMap.get(year).get(item.topic) || 0).toFixed(1)) }));
            const { a, b } = linearRegression(values.map((item, index) => ({ score: item.score, index: index + 1 })));
            const history = values.map((item) => item.score);
            const futureYears = [2027, 2028, 2029];
            const future = futureYears.map((year) => ({ year, value: Math.max(0, Number((a + b * (year - 2017 + 1)).toFixed(1))) }));
            return {
                name: item.topic,
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2.5 },
                data: [...history, ...future.map((item) => item.value)]
            };
        });

        const difficultySeries = topTopics.map((item) => {
            const values = years.map((year) => ({ year, score: Number((yearMap.get(year).get(item.topic) || 0).toFixed(1)) }));
            return {
                name: item.topic,
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 5,
                lineStyle: { width: 2 },
                data: values.map((item) => Number((item.score * 0.85).toFixed(1)))
            };
        });

        const difficultyRatioData = years.map((year) => {
            const totals = difficultyTotals.get(year) || { 基础题: 0, 中档题: 0, 压轴难题: 0 };
            const total = totals.基础题 + totals.中档题 + totals.压轴难题 || 1;
            return {
                year,
                基础题: Number((totals.基础题 / total * 100).toFixed(1)),
                中档题: Number((totals.中档题 / total * 100).toFixed(1)),
                压轴难题: Number((totals.压轴难题 / total * 100).toFixed(1))
            };
        });

        await db.close();

        res.json({
            success: true,
            data: {
                subject,
                subjectName: subjectNames[subject] || subject,
                years,
                topics,
                heatmapData,
                topTopics,
                trendSeries,
                difficultySeries,
                difficultyRatioData,
                difficultyLabels: ['基础题', '中档题', '压轴难题']
            }
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
        // 修复中文文件名编码
        file.originalname = decodeFilename(file.originalname);

        // ── 第一级防御：文件名校验 ──
        const filenameCheck = validateKnowledgeFilename(file.originalname);
        if (!filenameCheck.valid) {
            return res.status(400).json({ success: false, error: filenameCheck.reason });
        }

        let preferredName = file.originalname || 'knowledge.json';
        let uploadedJson;
        try {
            uploadedJson = JSON.parse(fs.readFileSync(file.path, 'utf-8'));
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                error: `JSON 解析失败：${parseError.message}。请确认上传的是合法 JSON 文件。`
            });
        }

        // ── 第二级防御：JSON 结构校验 ──
        const structureCheck = validateKnowledgeJsonStructure(uploadedJson);
        if (!structureCheck.valid) {
            return res.status(400).json({ success: false, error: structureCheck.reason });
        }

        if (uploadedJson?.专题 && !String(preferredName).includes(uploadedJson.专题)) {
            preferredName = `专题00 ${uploadedJson.专题}.json`;
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

// 预览 data/exports 下默认映射 CSV 文件状态
router.get('/kp-mapping/exports', async (req, res) => {
    try {
        const result = await runPython(IMPORT_KP_MAPPING_SCRIPT, ['--preview-exports', '--json']);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout
        });
    }
});

// 从 exports 目录批量导入映射 CSV
router.post('/import-kp-mapping-csv', async (req, res) => {
    const subject = req.body?.subject;
    const reset = req.body?.reset === true || req.body?.reset === 'true';
    const dryRun = req.body?.dryRun === true || req.body?.dryRun === 'true';
    const minConfidence = req.body?.minConfidence;

    try {
        const args = ['--json'];
        if (subject && ['chinese', 'math', 'english'].includes(subject)) {
            args.push('--subject', subject);
        } else {
            args.push('--all-exports');
        }
        if (reset) args.push('--reset');
        if (dryRun) args.push('--dry-run');
        if (minConfidence !== undefined && minConfidence !== null && minConfidence !== '') {
            args.push('--min-confidence', String(minConfidence));
        }

        const result = await runPython(IMPORT_KP_MAPPING_SCRIPT, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout
        });
    }
});

// 上传单个映射 CSV 并导入
router.post('/import-kp-mapping-csv/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    const reset = req.body?.reset === 'true' || req.body?.reset === true;
    const dryRun = req.body?.dryRun === 'true' || req.body?.dryRun === true;
    const subject = req.body?.subject;
    const minConfidence = req.body?.minConfidence;

    if (!file) {
        return res.status(400).json({ success: false, error: 'No CSV file uploaded' });
    }

    try {
        const args = ['--csv', file.path, '--json'];
        if (reset) args.push('--reset');
        if (dryRun) args.push('--dry-run');
        if (subject && ['chinese', 'math', 'english'].includes(subject)) {
            args.push('--subject', subject);
        }
        if (minConfidence !== undefined && minConfidence !== null && minConfidence !== '') {
            args.push('--min-confidence', String(minConfidence));
        }

        const result = await runPython(IMPORT_KP_MAPPING_SCRIPT, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout
        });
    } finally {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
});

module.exports = router;
