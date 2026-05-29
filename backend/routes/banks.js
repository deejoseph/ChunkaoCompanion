const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// 答案库目录
const BANKS_DIR = path.join(__dirname, '../../data/question_banks');
const DB_PATH = path.join(__dirname, '../../data/knowledge/chunkao.db');

// 确保目录存在
if (!fs.existsSync(BANKS_DIR)) {
    fs.mkdirSync(BANKS_DIR, { recursive: true });
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

function parseJsonField(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

async function openDb() {
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

async function loadBankFromDb(db, bankId) {
    const bank = await db.get(
        `SELECT id, title, source_title, subject_id, version_id, total_questions, source_path,
                source_format, paper_type, year, updated_at
         FROM question_banks
         WHERE id = ?`,
        [bankId]
    );

    if (!bank) return null;

    const questions = await db.all(
        `SELECT id, number, original_number, type, content, source_answer, final_answer,
                my_answer, peer_answers, ai_answers, discussion, analysis, score, difficulty,
                page_number, parse_confidence, needs_review, source
         FROM questions
         WHERE bank_id = ?
         ORDER BY number ASC, original_number ASC`,
        [bank.id]
    );

    return {
        paperId: bank.id,
        id: bank.id,
        title: bank.title,
        sourceTitle: bank.source_title || bank.title,
        subject: bank.subject_id,
        version: bank.version_id,
        totalQuestions: bank.total_questions || questions.length,
        sourcePath: bank.source_path,
        sourceFormat: bank.source_format,
        paperType: bank.paper_type,
        year: bank.year,
        updatedAt: bank.updated_at,
        questions: questions.map((question, index) => ({
            id: question.original_number || `q${index + 1}`,
            dbId: question.id,
            number: question.number || index + 1,
            originalNumber: question.original_number,
            type: question.type,
            content: question.content,
            sourceAnswer: question.source_answer || '',
            finalAnswer: question.final_answer || '',
            myAnswer: question.my_answer || '',
            peerAnswers: parseJsonField(question.peer_answers, {}),
            aiAnswers: parseJsonField(question.ai_answers, {}),
            discussion: question.discussion || '',
            analysis: question.analysis || '',
            score: question.score,
            difficulty: question.difficulty,
            pageNumber: question.page_number,
            parseConfidence: question.parse_confidence,
            needsReview: Boolean(question.needs_review),
            source: question.source
        }))
    };
}

function readBankJsonById(id) {
    const directPath = path.join(BANKS_DIR, `${id}_question_bank.json`);
    if (fs.existsSync(directPath)) {
        return JSON.parse(fs.readFileSync(directPath, 'utf-8'));
    }

    const files = fs.readdirSync(BANKS_DIR).filter(file => file.endsWith('_question_bank.json'));
    for (const file of files) {
        const filePath = path.join(BANKS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data.paperId === id || data.id === id) {
            return data;
        }
    }

    return null;
}

function scoreTitleMatch(candidate, title) {
    if (!title) return 10;
    const target = normalizeTitle(title);
    const candidateTitle = normalizeTitle(candidate.title || candidate.source_title || candidate.sourceTitle || '');
    const candidateSource = normalizeTitle(candidate.source_title || candidate.sourceTitle || '');

    if (candidateTitle === target || candidateSource === target) return 100;
    if (candidateTitle.includes(target) || target.includes(candidateTitle)) return 70;
    if (candidateSource.includes(target) || target.includes(candidateSource)) return 60;
    return 0;
}

async function findBestBankInDb(db, subject, title) {
    const params = [];
    const where = [];
    if (subject) {
        where.push('subject_id = ?');
        params.push(subject);
    }

    const candidates = await db.all(
        `SELECT id, title, source_title, subject_id, version_id
         FROM question_banks
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY updated_at DESC`
        ,
        params
    );

    let best = null;
    let bestScore = 0;
    for (const candidate of candidates) {
        const score = scoreTitleMatch(candidate, title);
        if (score > bestScore) {
            best = candidate;
            bestScore = score;
        }
    }

    return best && bestScore > 0 ? loadBankFromDb(db, best.id) : null;
}

// 获取所有题库列表（从数据库读取）
router.get('/list', async (req, res) => {
    try {
        const db = await openDb();
        
        const banks = await db.all(
            `SELECT id, title, subject_id as subject, version_id as version, total_questions as totalQuestions 
             FROM question_banks 
             ORDER BY created_at DESC`
        );
        
        await db.close();
        
        res.json({ success: true, banks: banks });
    } catch (error) {
        console.error('获取题库列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 搜索题库（优先 SQLite，JSON 只作为历史备份兜底）
router.get('/search', async (req, res) => {
    const { subject, title } = req.query;
    
    console.log('搜索参数:', { subject, title });
    
    if (!subject && !title) {
        return res.status(400).json({ success: false, error: '缺少搜索参数' });
    }
    
    try {
        const db = await openDb();
        const dbMatch = await findBestBankInDb(db, subject, title);
        await db.close();

        if (dbMatch) {
            console.log('数据库匹配成功:', dbMatch.title);
            return res.json({ success: true, bank: dbMatch });
        }

        const files = fs.readdirSync(BANKS_DIR);
        let bestMatch = null;
        let bestScore = 0;
        
        for (const file of files) {
            if (!file.endsWith('_question_bank.json')) continue;
            
            const filePath = path.join(BANKS_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            // 学科必须匹配
            if (subject && data.subject !== subject) continue;
            const score = Math.max(scoreTitleMatch(data, title), file.includes(String(title || '').replace(/\s/g, '')) ? 30 : 0);
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = data;
            }
        }
        
        if (bestMatch) {
            console.log('匹配成功:', bestMatch.title);
            res.json({ success: true, bank: bestMatch });
        } else {
            console.log('未找到匹配的题库');
            res.json({ success: true, bank: null });
        }
    } catch (error) {
        console.error('搜索失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取单个题库（优先 SQLite，JSON 只作为历史备份兜底）
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const db = await openDb();
        const bank = await loadBankFromDb(db, id);
        await db.close();

        if (bank) {
            return res.json({ success: true, bank });
        }

        const data = readBankJsonById(id);
        if (!data) {
            return res.status(404).json({ success: false, error: '题库不存在' });
        }
        res.json({ success: true, bank: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 保存题库（同时保存到数据库）
router.post('/save', async (req, res) => {
    const { paperId, title, sourceTitle, subject, version, knowledgePoints, questions } = req.body;
    
    if (!paperId || !title) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    try {
        const db = await openDb();
        const backupFileName = `${paperId}_question_bank.json`;
        const backupPath = path.join('data/question_banks', backupFileName);
        
        // 保存或更新 question_banks
        await db.run(
            `INSERT OR REPLACE INTO question_banks 
             (id, title, source_title, subject_id, version_id, source_path, source_format, paper_type,
              total_questions, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'json', 'question_bank', ?, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                source_title=excluded.source_title,
                subject_id=excluded.subject_id,
                version_id=excluded.version_id,
                source_path=excluded.source_path,
                source_format=excluded.source_format,
                paper_type=excluded.paper_type,
                total_questions=excluded.total_questions,
                updated_at=excluded.updated_at`,
            [paperId, title, sourceTitle || title, subject, version, backupPath, questions.length]
        );

        await db.run(`DELETE FROM questions WHERE bank_id = ?`, [paperId]);
        
        // 保存题目
        for (const [index, q] of questions.entries()) {
            const number = Number.parseInt(String(q.id || '').replace('q', ''), 10) || index + 1;
            const peerAnswers = q.peerAnswers || q.aiAnswers || {};
            const myAnswer = q.myAnswer || q.finalAnswer || '';
            await db.run(
                `INSERT OR REPLACE INTO questions 
                 (id, bank_id, subject_id, version_id, number, original_number, type, content, 
                  source_answer, final_answer, my_answer, peer_answers, ai_answers, discussion, analysis, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [`${paperId}_${q.id}`, paperId, subject, version, 
                 number, q.id || `q${number}`, q.type, q.content,
                 q.sourceAnswer || '', q.finalAnswer || '', myAnswer,
                 JSON.stringify(peerAnswers), JSON.stringify(q.aiAnswers || {}), q.discussion || '',
                 q.analysis || '']
            );
        }
        
        await db.close();
        
        // 同时也保存到 JSON 文件作为备份
        const bankData = {
            paperId,
            title,
            subject,
            version,
            knowledgePoints: knowledgePoints || [],
            totalQuestions: questions.length,
            questions: questions
        };
        
        const filePath = path.join(BANKS_DIR, `${paperId}_question_bank.json`);
        fs.writeFileSync(filePath, JSON.stringify(bankData, null, 2), 'utf-8');
        
        res.json({ success: true, message: '保存成功' });
    } catch (error) {
        console.error('保存失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除单个题库（同步清理 SQLite 与 JSON 备份）
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const db = await openDb();
        const bank = await db.get(`SELECT source_path FROM question_banks WHERE id = ?`, [id]);
        await db.run(
            `DELETE FROM question_assets
             WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)`,
            [id]
        );
        await db.run(
            `DELETE FROM question_knowledge_points
             WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)`,
            [id]
        );
        await db.run(`DELETE FROM questions WHERE bank_id = ?`, [id]);
        const result = await db.run(`DELETE FROM question_banks WHERE id = ?`, [id]);
        await db.close();

        const candidatePaths = [
            path.join(BANKS_DIR, `${id}_question_bank.json`),
            bank?.source_path ? path.join(__dirname, '../..', bank.source_path) : null
        ].filter(Boolean);

        let deletedJson = false;
        for (const filePath of candidatePaths) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                deletedJson = true;
            }
        }

        if (result.changes === 0 && !deletedJson) {
            return res.status(404).json({ success: false, error: '题库不存在' });
        }

        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除整个学科的所有题库
router.delete('/subject/:subject', (req, res) => {
    const { subject } = req.params;
    
    try {
        const files = fs.readdirSync(BANKS_DIR);
        let deletedCount = 0;
        
        for (const file of files) {
            if (!file.endsWith('_question_bank.json')) continue;
            
            const filePath = path.join(BANKS_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            if (data.subject === subject) {
                fs.unlinkSync(filePath);
                deletedCount++;
                console.log(`删除题库: ${file}`);
            }
        }
        
        res.json({ 
            success: true, 
            message: `删除了 ${deletedCount} 个题库`,
            deletedCount: deletedCount
        });
    } catch (error) {
        console.error('删除学科失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/update-answer', async (req, res) => {
    const { questionNumber, bankId, sourceAnswer } = req.body;
    
    try {
        const db = await openDb();
        
        // 主要更新：使用 number 而不是 original_number
        let result = await db.run(
            `UPDATE questions SET source_answer = ?, updated_at = datetime('now') 
             WHERE number = ? AND bank_id = ?`,
            [sourceAnswer, questionNumber, bankId]
        );

        // 如果精确匹配失败，尝试模糊匹配 bank_id（兼容可能的前端传短ID）
        if (result.changes === 0) {
            result = await db.run(
                `UPDATE questions SET source_answer = ?, updated_at = datetime('now')
                 WHERE number = ? AND bank_id LIKE ?`,
                [sourceAnswer, questionNumber, `%${bankId}%`]
            );
        }
        
        await db.close();
        
        if (result.changes === 0) {
            return res.json({ success: false, error: '未找到对应题目' });
        }
        
        res.json({ success: true, message: '答案已更新' });
    } catch (error) {
        console.error('更新答案失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
