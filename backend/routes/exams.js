const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 目录配置
const EXAMS_BASE = path.join(__dirname, '../../data/exams');
const MOCK_BASE = path.join(__dirname, '../../data/exams/mock');

// 递归获取目录下所有PDF文件（不依赖年份参数）
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
    
    if (!fs.existsSync(subjectDir)) {
        return res.json({ success: true, papers: [] });
    }
    
    try {
        // 获取该学科下所有PDF
        const allFiles = getAllPDFFiles(subjectDir);
        
        // 按年份筛选：文件名或路径中包含年份
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
    
    if (!fs.existsSync(mockDir)) {
        return res.json({ success: true, papers: [] });
    }
    
    try {
        const papers = getAllPDFFiles(mockDir);
        console.log(`加载模拟卷: ${subject}/${year} -> ${papers.length}个`);
        res.json({ success: true, papers: papers });
    } catch (error) {
        console.error('加载模拟卷失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取PDF文件（通过学科、年份、类型、文件名定位）
router.get('/pdf/:subject/:year/:type/:filename', (req, res) => {
    const { subject, year, type, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    
    console.log('========== PDF请求 ==========');
    console.log('subject:', subject);
    console.log('year:', year);
    console.log('type:', type);
    console.log('filename:', decodedFilename);
    
    let filePath;
    if (type === 'exam') {
        const examDir = path.join(EXAMS_BASE, subject);
        console.log('examDir:', examDir);
        const found = findFileRecursively(examDir, decodedFilename);
        console.log('found:', found);
        if (found) {
            filePath = found;
        }
    } else if (type === 'mock') {
        filePath = path.join(EXAMS_BASE, 'mock', subject, year, decodedFilename);
        console.log('mock filePath:', filePath);
        console.log('exists:', fs.existsSync(filePath));
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: '文件不存在' });
    }
    
    res.sendFile(filePath);
});

// 递归查找文件
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

// ========== 听力接口 ==========
router.get('/listening/list', (req, res) => {
    const listeningDir = path.join(EXAMS_BASE, 'listening');
    
    if (!fs.existsSync(listeningDir)) {
        return res.json({ success: true, list: [] });
    }
    
    try {
        const folders = fs.readdirSync(listeningDir);
        const list = [];
        
        for (const folder of folders) {
            const folderPath = path.join(listeningDir, folder);
            if (fs.statSync(folderPath).isDirectory()) {
                const files = fs.readdirSync(folderPath);
                const audioFile = files.find(f => f.endsWith('.mp3'));
                const pdfFile = files.find(f => f.endsWith('.pdf'));
                
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

router.get('/listening/audio/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    const filePath = path.join(EXAMS_BASE, 'listening', folder, decodeURIComponent(filename));
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: '音频文件不存在' });
    }
    res.sendFile(filePath);
});

router.get('/listening/pdf/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    const filePath = path.join(EXAMS_BASE, 'listening', folder, decodeURIComponent(filename));
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: '文件不存在' });
    }
    res.sendFile(filePath);
});

router.get('/listening/check/:year', (req, res) => {
    const { year } = req.params;
    const listeningDir = path.join(EXAMS_BASE, 'listening');
    
    if (fs.existsSync(listeningDir)) {
        const folders = fs.readdirSync(listeningDir);
        for (const folder of folders) {
            const folderPath = path.join(listeningDir, folder);
            if (fs.statSync(folderPath).isDirectory()) {
                const files = fs.readdirSync(folderPath);
                const audioFile = files.find(f => f.endsWith('.mp3'));
                if (audioFile && folder.includes(year)) {
                    res.json({
                        hasListening: true,
                        audioUrl: `/api/exams/listening/audio/${folder}/${audioFile}`
                    });
                    return;
                }
            }
        }
    }
    res.json({ hasListening: false });
});

module.exports = exports = router;