const path = require('path');
const fs = require('fs');
const { saveParsedBank } = require('../services/saveParsedBank');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

(async () => {
    try {
        const projectRoot = path.resolve(__dirname, '..', '..');
        const testDbDir = path.join(projectRoot, 'data', 'knowledge');
        if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
        const testDb = path.join(testDbDir, 'test_chunkao.db');

        // remove old test db if exists
        if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

        // create schema by copying from real db if exists, else create minimal schema
        const realDb = path.join(testDbDir, 'chunkao.db');
        if (fs.existsSync(realDb)) {
            fs.copyFileSync(realDb, testDb);
        } else {
            // create minimal schema
            const db = await open({ filename: testDb, driver: sqlite3.Database });
            await db.exec(`
                CREATE TABLE question_banks (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    source_title TEXT,
                    subject_id TEXT,
                    version_id TEXT,
                    source_path TEXT,
                    source_format TEXT,
                    paper_type TEXT,
                    total_questions INTEGER,
                    created_at TEXT,
                    updated_at TEXT
                );
                CREATE TABLE questions (
                    id TEXT PRIMARY KEY,
                    bank_id TEXT,
                    subject_id TEXT,
                    version_id TEXT,
                    number INTEGER,
                    original_number TEXT,
                    type TEXT,
                    content TEXT,
                    source_answer TEXT,
                    final_answer TEXT,
                    my_answer TEXT,
                    peer_answers TEXT,
                    ai_answers TEXT,
                    discussion TEXT,
                    analysis TEXT,
                    created_at TEXT,
                    updated_at TEXT
                );
            `);
            await db.close();
        }

        // prepare test bank
        const paperId = `test_bank_${Date.now()}`;
        const bank = {
            paperId,
            title: '测试题库',
            sourceTitle: '测试题库来源',
            subject: 'chinese',
            version: '2026',
            sourcePath: '/data/docs/test.pdf',
            sourceFormat: 'pdf',
            paperType: 'mock',
            knowledgePoints: [],
            questions: [
                { id: 'q1', type: 'qa', content: '问题一 内容', sourceAnswer: '答案一' },
                { id: 'q2', type: 'choice', content: '选择题 内容 A.B.C.D', sourceAnswer: 'A' }
            ]
        };

        // run save
        const result = await saveParsedBank({ dbFile: testDb, bank });
        console.log('saveParsedBank result:', result);

        // verify db
        const db = await open({ filename: testDb, driver: sqlite3.Database });
        const bankRow = await db.get('SELECT * FROM question_banks WHERE id = ?', [paperId]);
        const questions = await db.all('SELECT * FROM questions WHERE bank_id = ? ORDER BY number ASC', [paperId]);
        await db.close();

        console.log('bankRow:', !!bankRow);
        console.log('questions count:', questions.length);

        const jsonPath = result.jsonPath;
        console.log('json exists:', fs.existsSync(jsonPath));

        // cleanup
        if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
        if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);

        if (bankRow && questions.length === 2) {
            console.log('TEST PASSED');
            process.exit(0);
        } else {
            console.error('TEST FAILED');
            process.exit(2);
        }
    } catch (err) {
        console.error('Test error:', err);
        process.exit(3);
    }
})();
