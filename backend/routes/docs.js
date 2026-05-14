const express = require('express');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const router = express.Router();

// 使用项目内的目录
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DOCS_BASE = {
    chinese: path.join(PROJECT_ROOT, 'data/docs/chinese/2026'),
    chinese2025: path.join(PROJECT_ROOT, 'data/docs/chinese/2025'),
    math: path.join(PROJECT_ROOT, 'data/docs/math/2026'),
    math2025: path.join(PROJECT_ROOT, 'data/docs/math/2025'),
    english: path.join(PROJECT_ROOT, 'data/docs/english/2026'),
    english2025: path.join(PROJECT_ROOT, 'data/docs/english/2025')
};

console.log('=== 文档目录配置 ===');
Object.entries(DOCS_BASE).forEach(([key, dir]) => {
    console.log(`${key}: ${dir} (${fs.existsSync(dir) ? '✅' : '❌'})`);
});

router.get('/topics/:subject/:version', (req, res) => {
    const { subject, version } = req.params;
    const dirKey = version === '2025' ? `${subject}2025` : subject;
    const docsDir = DOCS_BASE[dirKey];
    
    if (!docsDir || !fs.existsSync(docsDir)) {
        return res.status(404).json({ success: false, error: `目录不存在: ${docsDir}` });
    }
    
    try {
        // 获取所有PDF文件
        const files = fs.readdirSync(docsDir)
            .filter(f => f.endsWith('.pdf') && !f.startsWith('~$'));
        
        // 配对：将同一个专题的教师版和学生版合并
        const topicMap = new Map();
        
        for (const file of files) {
            let teacherFile = null;
            let studentFile = null;
            let name = file.replace('.pdf', '');
            
            // 判断是教师版还是学生版，并提取专题名称
            if (name.includes('（教师版）')) {
                teacherFile = file;
                name = name.replace('（教师版）', '');
            } else if (name.includes('（学生版）')) {
                studentFile = file;
                name = name.replace('（学生版）', '');
            } else {
                // 没有版本标识的文件，跳过或作为学生版处理
                continue;
            }
            
            name = name.trim();
            
            if (!topicMap.has(name)) {
                topicMap.set(name, {
                    id: encodeURIComponent(name),
                    name: name,
                    teacherFile: null,
                    studentFile: null
                });
            }
            
            const topic = topicMap.get(name);
            if (teacherFile) topic.teacherFile = teacherFile;
            if (studentFile) topic.studentFile = studentFile;
        }
        
        // 只返回同时有教师版和学生版的专题（或者根据需要调整）
        const topics = Array.from(topicMap.values());
        
        console.log(`加载专题: ${subject}/${version} -> ${topics.length}个`);
        res.json({ success: true, topics: topics });
    } catch (error) {
        console.error('加载专题失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 读取Word文件内容（保留，但专题已改用PDF）
router.get('/content/:subject/:version/:filename', async (req, res) => {
    const { subject, version, filename } = req.params;
    const dirKey = version === '2025' ? `${subject}2025` : subject;
    const docsDir = DOCS_BASE[dirKey];
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(docsDir, decodedFilename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: `文件不存在: ${filePath}` });
    }
    
    try {
        const result = await mammoth.convertToHtml({
            path: filePath,
            options: {
                styleMap: [
                    "u => u",
                    "ins => ins",
                    "p[style-name='Heading 1'] => h1",
                    "p[style-name='Heading 2'] => h2",
                    "p[style-name='Heading 3'] => h3"
                ]
            }
        });
        
        let html = result.value;
        
        // 移除广告图片
        html = html.replace(/<img[^>]*>/gi, '');
        html = html.replace(/<img[^>]*src="data:image[^"]*"[^>]*>/gi, '');
        
        // 移除包含广告关键词的段落
        const adPatterns = [/赠送.*?2000G/i, /2000G.*?学习资料/i, /扫码.*?关注/i, /公众号/i, /免费.*?领取/i];
        for (const pattern of adPatterns) {
            html = html.replace(new RegExp(`<p[^>]*>${pattern.source}[^<]*</p>`, 'gi'), '');
            html = html.replace(new RegExp(`<div[^>]*>${pattern.source}[^<]*</div>`, 'gi'), '');
        }
        
        html = html.replace(/<p>\s*<\/p>/gi, '');
        html = html.replace(/<div>\s*<\/div>/gi, '');
        
        // 修复下划线
        html = html.replace(/_{2,}/g, (match) => {
            const width = Math.min(match.length * 10, 120);
            return `<span class="fill-blank" style="display:inline-block; min-width:${width}px; border-bottom:2px solid #333; background:#fafafa;"></span>`;
        });
        html = html.replace(/\.{3,}/g, (match) => {
            const width = Math.min(match.length * 6, 80);
            return `<span class="fill-blank" style="display:inline-block; min-width:${width}px; border-bottom:1px dashed #999;"></span>`;
        });
        html = html.replace(/&nbsp;&nbsp;+/g, (match) => {
            const width = Math.min(match.length * 4, 100);
            return `<span class="fill-blank" style="display:inline-block; min-width:${width}px; border-bottom:2px solid #333;"></span>`;
        });
        html = html.replace(/（\s*）/g, '<span class="fill-blank" style="display:inline-block; min-width:80px; border-bottom:2px solid #333; background:#fafafa;"></span>');
        html = html.replace(/\(\s*\)/g, '<span class="fill-blank" style="display:inline-block; min-width:60px; border-bottom:2px solid #333;"></span>');
        html = html.replace(/：\s*，/g, '：<span class="fill-blank" style="display:inline-block; min-width:100px; border-bottom:2px solid #333;"></span>，');
        
        html = html.replace(/<td[^>]*>([^<]*?)_{2,}([^<]*?)<\/td>/gi, (match, before, after) => {
            const newMatch = match.replace(/_{2,}/g, (m) => {
                const w = Math.min(m.length * 10, 80);
                return `<span class="fill-blank" style="display:inline-block; min-width:${w}px; border-bottom:2px solid #333;"></span>`;
            });
            return newMatch;
        });
        
        // 处理答案和解析
        html = html.replace(/(【答案】[^【]*?)(?=【|$)/g, (match) => {
            return `<div class="answer-box" style="background:#fff5f5; padding:10px 15px; margin:15px 0; border-radius:8px;">${match}</div>`;
        });
        html = html.replace(/(【解析】[^【]*?)(?=【|$)/g, (match) => {
            return `<div class="answer-box" style="background:#f0f7ff; padding:10px 15px; margin:15px 0; border-radius:8px;">${match}</div>`;
        });
        html = html.replace(/【答案】/g, '<strong style="color:#e74c3c;">【答案】</strong>');
        html = html.replace(/【解析】/g, '<strong style="color:#e74c3c;">【解析】</strong>');
        
        // 处理表格
        html = html.replace(/<table/g, '<table class="doc-table" style="border-collapse:collapse; width:100%; margin:16px 0;"');
        html = html.replace(/<th/g, '<th style="border:1px solid #ddd; padding:8px; background:#f5f5f5; text-align:center;"');
        html = html.replace(/<td/g, '<td style="border:1px solid #ddd; padding:8px;"');
        
        // 处理列表
        html = html.replace(/<ul>/g, '<ul style="margin:8px 0; padding-left:24px;">');
        html = html.replace(/<ol>/g, '<ol style="margin:8px 0; padding-left:24px;">');
        
        // 修复图片路径
        const mediaDir = path.join(docsDir, 'media');
        if (fs.existsSync(mediaDir)) {
            html = html.replace(/src="media\//g, `src="${mediaDir}/`);
        }
        
        res.json({
            success: true,
            filename: filename,
            html: html
        });
    } catch (error) {
        console.error('解析Word失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取所有学科的专题列表
router.get('/all-topics', (req, res) => {
    const allTopics = [];
    
    for (const [key, dir] of Object.entries(DOCS_BASE)) {
        if (fs.existsSync(dir)) {
            try {
                const files = fs.readdirSync(dir)
                    .filter(f => f.endsWith('.pdf') && !f.startsWith('~$'))
                    .map(f => ({
                        id: `${key}_${encodeURIComponent(f.replace('.pdf', ''))}`,
                        name: f.replace('.pdf', ''),
                        filename: f,
                        subject: key.replace('2025', ''),
                        version: key.includes('2025') ? '2025' : '2026'
                    }));
                allTopics.push(...files);
            } catch (err) {
                console.error(`读取目录失败 ${key}:`, err);
            }
        }
    }
    
    res.json({ success: true, topics: allTopics });
});

// 获取PDF文件（直接返回文件流）
router.get('/pdf/:subject/:version/:filename', (req, res) => {
    const { subject, version, filename } = req.params;
    const dirKey = version === '2025' ? `${subject}2025` : subject;
    const docsDir = DOCS_BASE[dirKey];
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(docsDir, decodedFilename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: '文件不存在' });
    }
    
    res.sendFile(filePath);
});

// 批量处理Word文档（只处理没有对应PDF的新文件）
router.post('/process', (req, res) => {
    const { deleteOriginal } = req.body;
    const scriptPath = path.join(PROJECT_ROOT, 'scripts/remove_last_image.py');
    
    const cmd = `python "${scriptPath}" ${deleteOriginal ? '--delete' : ''} --new-only`;
    
    exec(cmd, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
        if (error) {
            console.error('执行失败:', error);
            return res.status(500).json({ success: false, message: stderr || error.message });
        }
        res.json({ success: true, message: stdout });
    });
});

// 测试接口：直接列出所有文件
router.get('/test/:subject/:version', (req, res) => {
    const { subject, version } = req.params;
    const dirKey = version === '2025' ? `${subject}2025` : subject;
    const docsDir = DOCS_BASE[dirKey];
    
    if (!docsDir || !fs.existsSync(docsDir)) {
        return res.json({ success: false, error: `目录不存在: ${docsDir}` });
    }
    
    try {
        const files = fs.readdirSync(docsDir);
        res.json({ 
            success: true, 
            dir: docsDir,
            files: files.filter(f => !f.startsWith('~$') && f.endsWith('.pdf'))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;