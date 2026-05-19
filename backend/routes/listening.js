const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const LISTENING_BASE = path.join(__dirname, '../../data/exams/listening');

// 获取听力列表
router.get('/list', (req, res) => {
    if (!fs.existsSync(LISTENING_BASE)) {
        return res.status(404).json({ success: false, error: '听力目录不存在' });
    }
    
    try {
        const folders = fs.readdirSync(LISTENING_BASE)
            .filter(f => fs.statSync(path.join(LISTENING_BASE, f)).isDirectory())
            .sort();
        
        const listeningList = [];
        
        for (const folder of folders) {
            const folderPath = path.join(LISTENING_BASE, folder);
            const files = fs.readdirSync(folderPath);
            
            const audioFile = files.find(f => f.endsWith('.mp3'));
            const teacherFile = files.find(f => f.endsWith('.pdf') && f.includes('教师版'));
            const studentFile = files.find(f => f.endsWith('.pdf') && f.includes('学生版'));
            
            // 提取序号
            const match = folder.match(/^(\d+)/);
            const index = match ? match[1] : '';
            
            listeningList.push({
                id: folder,
                index: index,
                name: folder,
                audioFile: audioFile || null,
                teacherFile: teacherFile || null,
                studentFile: studentFile || null,
                hasAudio: !!audioFile,
                hasTeacher: !!teacherFile,
                hasStudent: !!studentFile
            });
        }
        
        res.json({ success: true, list: listeningList });
    } catch (error) {
        console.error('获取听力列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取音频文件
router.get('/audio/:index/:filename', (req, res) => {
    const { index, filename } = req.params;
    // 解码文件名
    const decodedFilename = decodeURIComponent(filename);
    
    // 根据序号查找文件夹
    const folders = fs.readdirSync(LISTENING_BASE);
    const targetFolder = folders.find(f => f.startsWith(index));
    
    if (!targetFolder) {
        return res.status(404).json({ success: false, error: '文件夹不存在' });
    }
    
    const filePath = path.join(LISTENING_BASE, targetFolder, decodedFilename);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ success: false, error: '音频文件不存在' });
    }
});

// 获取PDF文件
router.get('/pdf/:index/:type/:filename', (req, res) => {
    const { index, type, filename } = req.params;
    // 解码文件名（处理中文）
    const decodedFilename = decodeURIComponent(filename);
    
    console.log('请求参数:', { index, type, filename: decodedFilename });
    
    // 根据序号查找文件夹
    const folders = fs.readdirSync(LISTENING_BASE);
    const targetFolder = folders.find(f => f.startsWith(index));
    
    if (!targetFolder) {
        console.log('文件夹不存在:', index);
        return res.status(404).json({ success: false, error: '文件夹不存在' });
    }
    
    const filePath = path.join(LISTENING_BASE, targetFolder, decodedFilename);
    console.log('查找文件:', filePath);
    console.log('文件是否存在:', fs.existsSync(filePath));
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        // 尝试模糊匹配（去掉可能的多余字符）
        const files = fs.readdirSync(path.join(LISTENING_BASE, targetFolder));
        console.log('目录中的文件:', files);
        
        // 尝试匹配包含关键词的文件
        const keyword = decodedFilename.includes('学生') ? '学生版' : '教师版';
        const matchedFile = files.find(f => f.includes(keyword) && f.endsWith('.pdf'));
        
        if (matchedFile) {
            console.log('匹配到文件:', matchedFile);
            res.sendFile(path.join(LISTENING_BASE, targetFolder, matchedFile));
        } else {
            res.status(404).json({ success: false, error: 'PDF文件不存在' });
        }
    }
});

module.exports = router;