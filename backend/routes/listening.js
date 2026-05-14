const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 听力目录配置
const LISTENING_BASE = 'D:/BaiduNetdiskDownload/上海听力专用';

// 获取听力列表
router.get('/list', (req, res) => {
    if (!fs.existsSync(LISTENING_BASE)) {
        return res.status(404).json({ success: false, error: '听力目录不存在' });
    }
    
    try {
        const folders = fs.readdirSync(LISTENING_BASE)
            .filter(f => f.startsWith('0') && fs.statSync(path.join(LISTENING_BASE, f)).isDirectory())
            .sort();
        
        const listeningList = [];
        
        for (const folder of folders) {
            const folderPath = path.join(LISTENING_BASE, folder);
            const files = fs.readdirSync(folderPath);
            
            const audioFile = files.find(f => f.endsWith('.mp3'));
            const pdfFile = files.find(f => f.endsWith('.docx') || f.endsWith('.pdf'));
            
            listeningList.push({
                id: folder,
                name: folder,
                audioFile: audioFile || null,
                pdfFile: pdfFile || null,
                hasAudio: !!audioFile,
                hasPdf: !!pdfFile
            });
        }
        
        res.json({ success: true, list: listeningList });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取音频文件
router.get('/audio/:filename', (req, res) => {
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    
    // 查找文件所在文件夹
    const folders = fs.readdirSync(LISTENING_BASE);
    for (const folder of folders) {
        const filePath = path.join(LISTENING_BASE, folder, decodedFilename);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
            return;
        }
    }
    
    res.status(404).json({ success: false, error: '音频文件不存在' });
});

// 获取PDF文件
router.get('/pdf/:filename', (req, res) => {
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    
    // 查找文件所在文件夹
    const folders = fs.readdirSync(LISTENING_BASE);
    for (const folder of folders) {
        const filePath = path.join(LISTENING_BASE, folder, decodedFilename);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
            return;
        }
    }
    
    res.status(404).json({ success: false, error: 'PDF文件不存在' });
});

module.exports = router;