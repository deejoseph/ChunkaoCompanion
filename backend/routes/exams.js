const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 目录配置
const EXAMS_BASE = path.join(__dirname, '../../data/exams');
const MOCK_BASE = path.join(__dirname, '../../data/exams/mock');

// 递归获取目录下所有PDF文件
function getAllPDFFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const itemPath = path.join(dir, item);
        try {
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                getAllPDFFiles(itemPath, fileList);
            } else if (stat.isFile() && item.toLowerCase().endsWith('.pdf')) {
                const id = Buffer.from(itemPath).toString('base64');
                fileList.push({
                    id: id,
                    name: item.replace('.pdf', ''),
                    filename: item,
                    fullPath: itemPath
                });
            }
        } catch (err) {
            console.error(`读取文件失败: ${itemPath}`, err);
        }
    }
    return fileList;
}

// ========== 真题接口 ==========
router.get('/papers/:subject/:year', (req, res) => {
    const { subject, year } = req.params;
    const subjectDir = path.join(EXAMS_BASE, subject);
    if (!fs.existsSync(subjectDir)) return res.json({ success: true, papers: [] });
    try {
        const allFiles = getAllPDFFiles(subjectDir);
        const papers = allFiles.filter(file => {
            const fileName = file.name;
            const fullPath = file.fullPath;
            return fileName.includes(year) || fullPath.includes(`【${year}】`);
        });
        console.log(`加载真题: ${subject}/${year} -> ${papers.length}个`);
        res.json({ success: true, papers: papers });
    } catch (error) {
        console.error('加载真题失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== 模拟卷接口 ==========
router.get('/mock/:subject/:year', (req, res) => {
    const { subject, year } = req.params;
    const mockDir = path.join(MOCK_BASE, subject, year);
    if (!fs.existsSync(mockDir)) return res.json({ success: true, papers: [] });
    try {
        const papers = getAllPDFFiles(mockDir);
        console.log(`加载模拟卷: ${subject}/${year} -> ${papers.length}个`);
        res.json({ success: true, papers: papers });
    } catch (error) {
        console.error('加载模拟卷失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取PDF文件
router.get('/pdf/:subject/:year/:type/:filename', (req, res) => {
    const { subject, year, type, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    let filePath;
    if (type === 'exam') {
        const examDir = path.join(EXAMS_BASE, subject);
        const found = findFileRecursively(examDir, decodedFilename);
        if (found) filePath = found;
    } else if (type === 'mock') {
        filePath = path.join(EXAMS_BASE, 'mock', subject, year, decodedFilename);
    }
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: '文件不存在' });
    }
    res.sendFile(filePath);
});

function findFileRecursively(dir, filename) {
    if (!fs.existsSync(dir)) return null;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
            const found = findFileRecursively(itemPath, filename);
            if (found) return found;
        } else if (stat.isFile() && item === filename) {
            return itemPath;
        }
    }
    return null;
}

// ========== 听力接口（真题目录优先，增强版） ==========

// 在英语真题目录中查找年份对应的音频文件
function findAudioInEnglishDir(year) {
    const englishDir = path.join(EXAMS_BASE, 'english');
    if (!fs.existsSync(englishDir)) {
        console.log(`[findAudio] 目录不存在: ${englishDir}`);
        return null;
    }

    const folders = fs.readdirSync(englishDir);
    console.log(`[findAudio] 扫描 ${year}, 文件夹列表:`, folders);

    // 多种匹配模式
    const patterns = [
        `【${year}】`,
        `[${year}]`,
        `${year}年`,
        `${year}`
    ];
    let targetFolder = null;
    for (const pattern of patterns) {
        targetFolder = folders.find(f => f.includes(pattern));
        if (targetFolder) break;
    }
    if (!targetFolder) {
        console.log(`[findAudio] 未找到匹配 ${year} 的文件夹`);
        return null;
    }

    const folderPath = path.join(englishDir, targetFolder);
    const files = fs.readdirSync(folderPath);
    const audioFile = files.find(f => f.toLowerCase().endsWith('.mp3'));
    if (!audioFile) {
        console.log(`[findAudio] 文件夹 ${targetFolder} 内无 mp3 文件`);
        return null;
    }

    console.log(`[findAudio] 找到音频: ${audioFile}`);
    return {
        filePath: path.join(folderPath, audioFile),
        fileName: audioFile,
        folderName: targetFolder
    };
}

// 真题模块听力检测
router.get('/listening/check/:year', (req, res) => {
    const { year } = req.params;
    console.log(`[听力检测] 年份: ${year}`);

    // 1. 从真题目录查找
    const audioInfo = findAudioInEnglishDir(year);
    if (audioInfo) {
        const audioUrl = `/api/exams/listening/audio-from-english/${year}/${encodeURIComponent(audioInfo.fileName)}`;
        return res.json({ hasListening: true, audioUrl });
    }

    // 2. 回退到 listening 目录（兼容旧结构）
    const listeningDir = path.join(EXAMS_BASE, 'listening');
    if (fs.existsSync(listeningDir)) {
        const folders = fs.readdirSync(listeningDir);
        for (const folder of folders) {
            if (folder === year) {
                const folderPath = path.join(listeningDir, folder);
                if (fs.statSync(folderPath).isDirectory()) {
                    const files = fs.readdirSync(folderPath);
                    const audioFile = files.find(f => f.toLowerCase().endsWith('.mp3'));
                    if (audioFile) {
                        const audioUrl = `/api/exams/listening/audio/${year}/${encodeURIComponent(audioFile)}`;
                        return res.json({ hasListening: true, audioUrl });
                    }
                }
            }
        }
    }

    res.json({ hasListening: false });
});

// 从真题目录提供音频文件（核心）
router.get('/listening/audio-from-english/:year/:filename', (req, res) => {
    const { year, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    
    // 复用检测函数，获取音频文件完整路径
    const audioInfo = findAudioInEnglishDir(year);
    if (!audioInfo) {
        console.error(`[音频流] 未找到年份 ${year} 的音频`);
        return res.status(404).json({ error: '未找到对应年份的音频文件' });
    }
    
    // 验证请求的文件名是否与实际文件一致（可选，防止路径遍历）
    if (audioInfo.fileName !== decodedFilename) {
        console.warn(`[音频流] 文件名不匹配: 请求 ${decodedFilename}, 实际 ${audioInfo.fileName}`);
        // 仍然尝试使用实际文件路径，因为前端可能编码问题
        // 但最好返回正确路径
    }
    
    const filePath = audioInfo.filePath;
    console.log(`[音频流] 提供文件: ${filePath}`);
    
    // 检查文件是否存在（再次确认）
    fs.access(filePath, fs.constants.R_OK, (err) => {
        if (err) {
            console.error(`[音频流] 文件不可读: ${err.message}`);
            return res.status(404).json({ error: '音频文件无法读取' });
        }
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(audioInfo.fileName)}"`);
        const stream = fs.createReadStream(filePath);
        stream.on('error', (streamErr) => {
            console.error(`[音频流] 读取错误: ${streamErr.message}`);
            if (!res.headersSent) res.status(500).json({ error: '读取音频失败' });
            else res.end();
        });
        stream.pipe(res);
    });
});

// 保留原有的 listening 目录音频服务（供独立听力模块使用）
router.get('/listening/audio/:year/:filename', (req, res) => {
    const { year, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(EXAMS_BASE, 'listening', year, decodedFilename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '音频文件不存在' });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});

// 独立听力模块的列表和PDF（保持不变）
router.get('/listening/list', (req, res) => {
    const listeningDir = path.join(EXAMS_BASE, 'listening');
    if (!fs.existsSync(listeningDir)) return res.json({ success: true, list: [] });
    try {
        const folders = fs.readdirSync(listeningDir);
        const list = [];
        for (const folder of folders) {
            const folderPath = path.join(listeningDir, folder);
            if (fs.statSync(folderPath).isDirectory()) {
                const files = fs.readdirSync(folderPath);
                const audioFile = files.find(f => f.toLowerCase().endsWith('.mp3'));
                const pdfFile = files.find(f => f.toLowerCase().endsWith('.pdf'));
                list.push({
                    id: folder,
                    name: folder,
                    audioFile: audioFile || null,
                    pdfFile: pdfFile || null,
                    hasAudio: !!audioFile,
                    hasPdf: !!pdfFile
                });
            }
        }
        res.json({ success: true, list: list });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/listening/pdf/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    const filePath = path.join(EXAMS_BASE, 'listening', folder, decodeURIComponent(filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: '文件不存在' });
    res.sendFile(filePath);
});

module.exports = router;