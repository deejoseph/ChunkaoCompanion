const express = require('express');
const path = require('path');
const { execFile } = require('child_process');

const router = express.Router();

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PYTHON = process.env.PYTHON_PATH || process.env.WHISPER_PYTHON_PATH || 'python';
const INIT_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/init_knowledge_db.py');
const QUERY_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/query_knowledge_db.py');
const IMPORT_BANKS_SCRIPT = path.join(PROJECT_ROOT, 'backend/scripts/import_question_banks.py');

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

module.exports = router;
