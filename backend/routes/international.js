const express = require('express');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const router = express.Router();

// 国际课程根目录
const INTERNATIONAL_BASE = path.join(__dirname, '../../data/International');

// 获取课程列表
router.get('/courses', (req, res) => {
    console.log('获取课程列表，目录:', INTERNATIONAL_BASE);
    
    if (!fs.existsSync(INTERNATIONAL_BASE)) {
        console.error('目录不存在:', INTERNATIONAL_BASE);
        return res.status(404).json({ success: false, error: '国际课程目录不存在' });
    }
    
    try {
        const courses = [];
        const items = fs.readdirSync(INTERNATIONAL_BASE);
        
        for (const item of items) {
            const itemPath = path.join(INTERNATIONAL_BASE, item);
            if (fs.statSync(itemPath).isDirectory()) {
                courses.push({
                    id: item,
                    name: item,
                    path: item
                });
            }
        }
        
        console.log(`找到 ${courses.length} 个课程:`, courses.map(c => c.name));
        res.json({ success: true, courses });
    } catch (error) {
        console.error('获取课程列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 递归获取课程结构
function getStructure(dirPath, relativePath = '') {
    const result = [];
    const items = fs.readdirSync(dirPath);
    
    items.sort((a, b) => {
        const aPath = path.join(dirPath, a);
        const bPath = path.join(dirPath, b);
        const aIsDir = fs.statSync(aPath).isDirectory();
        const bIsDir = fs.statSync(bPath).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });
    
    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        const relPath = relativePath ? `${relativePath}/${item}` : item;
        
        if (stat.isDirectory()) {
            result.push({
                type: 'folder',
                name: item,
                path: relPath,
                children: getStructure(fullPath, relPath)
            });
        } else {
            let fileType = 'other';
            if (item.endsWith('.mp4')) fileType = 'video';
            else if (item.endsWith('.mp3')) fileType = 'audio';
            else if (item.endsWith('.srt')) fileType = 'subtitle';
            else if (item.endsWith('.png') || item.endsWith('.jpg') || item.endsWith('.jpeg')) fileType = 'image';
            else if (item.endsWith('.docx')) fileType = 'document';
            else if (item.endsWith('.pdf')) fileType = 'pdf';
            
            result.push({
                type: 'file',
                name: item,
                path: relPath,
                fileType: fileType,
                size: stat.size
            });
        }
    }
    return result;
}

// 获取课程结构
router.get('/courses/:courseId/structure', (req, res) => {
    const { courseId } = req.params;
    const coursePath = path.join(INTERNATIONAL_BASE, courseId);
    
    console.log(`获取课程结构: ${courseId}, 路径: ${coursePath}`);
    
    if (!fs.existsSync(coursePath)) {
        return res.status(404).json({ success: false, error: 'Course not found' });
    }
    
    try {
        const structure = getStructure(coursePath);
        console.log(`课程 ${courseId} 结构获取成功`);
        res.json({ success: true, structure });
    } catch (error) {
        console.error('获取课程结构失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取根目录文件（课程讲义）
router.get('/root-file/:filename', (req, res) => {
    const { filename } = req.params;
    const fullPath = path.join(INTERNATIONAL_BASE, filename);
    
    console.log(`请求根目录文件: ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
        console.error(`文件不存在: ${fullPath}`);
        return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const ext = path.extname(fullPath).toLowerCase();
    
    if (ext === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
    } else if (ext === '.docx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(fullPath))}"`);
    } else {
        res.setHeader('Content-Type', 'application/octet-stream');
    }
    
    res.sendFile(fullPath);
});

// 获取课程内文件（视频、字幕等）
router.get(/^\/file\/([^\/]+)\/(.+)$/, (req, res) => {
    const courseId = decodeURIComponent(req.params[0]);
    const filePath = decodeURIComponent(req.params[1]);
    const fullPath = path.join(INTERNATIONAL_BASE, courseId, filePath);
    
    console.log(`请求文件: courseId=${courseId}, filePath=${filePath}`);
    console.log(`完整路径: ${fullPath}`);
    console.log(`文件是否存在: ${fs.existsSync(fullPath)}`);
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const ext = path.extname(fullPath).toLowerCase();
    
    if (ext === '.mp4') {
        res.setHeader('Content-Type', 'video/mp4');
    } else if (ext === '.mp3') {
        res.setHeader('Content-Type', 'audio/mpeg');
    } else if (ext === '.srt') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    } else if (ext === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
    } else if (ext === '.docx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(fullPath))}"`);
    } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
        res.setHeader('Content-Type', `image/${ext.substring(1)}`);
    } else {
        res.setHeader('Content-Type', 'application/octet-stream');
    }
    
    res.sendFile(fullPath);
});

// 预览文档（docx 转 HTML）
router.get(/^\/preview\/([^\/]+)\/(.+)$/, async (req, res) => {
    const courseId = decodeURIComponent(req.params[0]);
    const filePath = decodeURIComponent(req.params[1]);
    const fullPath = path.join(INTERNATIONAL_BASE, courseId, filePath);
    
    console.log(`预览文档: ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const ext = path.extname(fullPath).toLowerCase();
    
    if (ext === '.docx') {
        try {
            const result = await mammoth.convertToHtml({ path: fullPath });
            res.json({ success: true, html: result.value });
        } catch (error) {
            console.error('DOCX 转换失败:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    } else if (ext === '.pdf') {
        const fileUrl = `/api/international/file/${courseId}/${filePath}`;
        res.json({ success: true, pdfUrl: fileUrl });
    } else {
        res.json({ success: false, error: 'Unsupported file type for preview' });
    }
});

// SRT 转 VTT 函数
function srtToVtt(srtContent) {
    // 移除 BOM 头
    srtContent = srtContent.replace(/^\uFEFF/, '');
    
    let vtt = 'WEBVTT\n\n';
    const blocks = srtContent.trim().split(/\n\s*\n/);
    
    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length >= 2) {
            const timeLine = lines[1];
            const textLines = lines.slice(2);
            const timeLineVtt = timeLine.replace(/,/g, '.');
            vtt += `${timeLineVtt}\n`;
            vtt += `${textLines.join('\n')}\n\n`;
        }
    }
    return vtt;
}

// 获取 VTT 格式字幕（用于视频嵌入）
router.get(/^\/subtitle\/([^\/]+)\/(.+)$/, async (req, res) => {
    const courseId = decodeURIComponent(req.params[0]);
    const filePath = decodeURIComponent(req.params[1]);
    const fullPath = path.join(INTERNATIONAL_BASE, courseId, filePath);
    
    console.log(`请求字幕: ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, error: 'Subtitle not found' });
    }
    
    const ext = path.extname(fullPath).toLowerCase();
    
    if (ext === '.srt') {
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const vttContent = srtToVtt(content);
            res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
            res.send(vttContent);
        } catch (error) {
            console.error('字幕转换失败:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    } else if (ext === '.vtt') {
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.sendFile(fullPath);
    } else {
        res.status(400).json({ success: false, error: 'Not a subtitle file' });
    }
});

module.exports = router;