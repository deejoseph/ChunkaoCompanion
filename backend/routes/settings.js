const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const router = express.Router();

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DB_PATH = path.join(PROJECT_ROOT, 'data/knowledge/chunkao.db');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'data/knowledge/backups');

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * 获取数据库统计信息
 */
router.get('/db-info', async (req, res) => {
    try {
        const stats = fs.statSync(DB_PATH);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

        // 获取表数量统计
        const sqlite3 = require('sqlite3').verbose();
        const { open } = require('sqlite');
        const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
        const tableCount = tables.length;

        // 获取各表记录数
        const tableStats = [];
        for (const t of tables) {
            try {
                const row = await db.get(`SELECT COUNT(*) AS cnt FROM "${t.name}"`);
                tableStats.push({ name: t.name, count: row.cnt });
            } catch { /* skip */ }
        }

        await db.close();

        res.json({
            success: true,
            data: {
                path: DB_PATH,
                sizeMB: parseFloat(sizeMB),
                tableCount,
                tables: tableStats,
                lastModified: stats.mtime.toISOString()
            }
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

/**
 * 创建数据库备份
 * POST /api/settings/db-backup
 * body: { label?: string }
 */
router.post('/db-backup', (req, res) => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            return res.json({ success: false, error: '数据库文件不存在' });
        }

        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const label = req.body.label ? `_${req.body.label}` : '';
        const filename = `chunkao_${timestamp}${label}.db`;
        const backupPath = path.join(BACKUP_DIR, filename);

        fs.copyFileSync(DB_PATH, backupPath);

        const stats = fs.statSync(backupPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

        console.log(`✅ 数据库备份已创建: ${filename} (${sizeMB} MB)`);

        res.json({
            success: true,
            message: '备份创建成功',
            data: {
                filename,
                sizeMB: parseFloat(sizeMB),
                createdAt: now.toISOString()
            }
        });
    } catch (error) {
        console.error('备份失败:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * 获取备份列表
 * GET /api/settings/db-backup-list
 */
router.get('/db-backup-list', (req, res) => {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            return res.json({ success: true, data: [] });
        }

        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.db'))
            .map(filename => {
                const filepath = path.join(BACKUP_DIR, filename);
                const stats = fs.statSync(filepath);
                return {
                    filename,
                    sizeMB: parseFloat((stats.size / 1024 / 1024).toFixed(2)),
                    createdAt: stats.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, data: files });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

/**
 * 从备份恢复数据库
 * POST /api/settings/db-restore
 * body: { filename: string }
 */
router.post('/db-restore', (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) {
            return res.json({ success: false, error: '缺少文件名' });
        }

        // 安全检查：防止路径遍历攻击
        const sanitized = path.basename(filename);
        if (sanitized !== filename || !filename.endsWith('.db')) {
            return res.json({ success: false, error: '非法文件名' });
        }

        const backupPath = path.join(BACKUP_DIR, sanitized);
        if (!fs.existsSync(backupPath)) {
            return res.json({ success: false, error: '备份文件不存在' });
        }

        // 恢复前先自动创建一个当前数据库的备份（安全网）
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const safetyFilename = `chunkao_${timestamp}_auto_safety.db`;
        const safetyPath = path.join(BACKUP_DIR, safetyFilename);
        if (fs.existsSync(DB_PATH)) {
            fs.copyFileSync(DB_PATH, safetyPath);
            console.log(`🛡️ 恢复前自动安全备份: ${safetyFilename}`);
        }

        // 执行恢复
        fs.copyFileSync(backupPath, DB_PATH);

        const stats = fs.statSync(DB_PATH);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

        console.log(`✅ 数据库已从 ${sanitized} 恢复 (${sizeMB} MB)`);

        res.json({
            success: true,
            message: `数据库已从 ${sanitized} 恢复`,
            data: {
                restoredFrom: sanitized,
                sizeMB: parseFloat(sizeMB),
                safetyBackup: safetyFilename,
                restoredAt: now.toISOString()
            }
        });
    } catch (error) {
        console.error('恢复失败:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * 删除备份文件
 * DELETE /api/settings/db-backup/:filename
 */
router.delete('/db-backup/:filename', (req, res) => {
    try {
        const { filename } = req.params;

        // 安全检查
        const sanitized = path.basename(filename);
        if (sanitized !== filename || !filename.endsWith('.db')) {
            return res.json({ success: false, error: '非法文件名' });
        }

        const backupPath = path.join(BACKUP_DIR, sanitized);
        if (!fs.existsSync(backupPath)) {
            return res.json({ success: false, error: '文件不存在' });
        }

        fs.unlinkSync(backupPath);
        console.log(`🗑️ 已删除备份: ${sanitized}`);

        res.json({ success: true, message: `已删除 ${sanitized}` });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

/**
 * 下载备份文件
 * GET /api/settings/db-backup-download/:filename
 */
router.get('/db-backup-download/:filename', (req, res) => {
    try {
        const { filename } = req.params;

        // 安全检查
        const sanitized = path.basename(filename);
        if (sanitized !== filename || !filename.endsWith('.db')) {
            return res.status(400).json({ error: '非法文件名' });
        }

        const backupPath = path.join(BACKUP_DIR, sanitized);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: '文件不存在' });
        }

        res.download(backupPath, sanitized);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 发送报告邮件
 * POST /api/settings/send-report
 * body: { to, subject, html, smtp }
 */
router.post('/send-report', async (req, res) => {
    try {
        const { to, subject, html, smtp } = req.body;
        if (!to || !html) {
            return res.json({ success: false, error: '缺少收件人或报告内容' });
        }

        // SMTP 配置：优先用前端传入的，否则从环境变量读取
        const smtpHost = (smtp && smtp.host) || process.env.SMTP_HOST || 'smtp.qq.com';
        const smtpPort = parseInt((smtp && smtp.port) || process.env.SMTP_PORT || '465');
        const smtpUser = (smtp && smtp.user) || process.env.SMTP_USER || '';
        const smtpPass = (smtp && smtp.pass) || process.env.SMTP_PASS || '';

        if (!smtpUser || !smtpPass) {
            return res.json({
                success: false,
                error: '邮件服务未配置。请在【设置】中填写 SMTP 配置。'
            });
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass }
        });

        const mailOptions = {
            from: `"Chunkao Companion" <${smtpUser}>`,
            to: to,
            subject: subject || '学习周报',
            html: html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ 报告邮件已发送至 ${to}，Message ID: ${info.messageId}`);

        res.json({
            success: true,
            message: `报告已发送至 ${to}`,
            messageId: info.messageId
        });
    } catch (error) {
        console.error('发送邮件失败:', error.message);
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
