const express = require('express');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const PDFParser = require('pdf2json');

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
        const files = fs.readdirSync(docsDir)
            .filter(f => f.endsWith('.pdf') && !f.startsWith('~$'));
        
        const topicMap = new Map();
        
        for (const file of files) {
            let teacherFile = null;
            let studentFile = null;
            let name = file.replace('.pdf', '');
            
            if (name.includes('（教师版）')) {
                teacherFile = file;
                name = name.replace('（教师版）', '');
            } else if (name.includes('（学生版）')) {
                studentFile = file;
                name = name.replace('（学生版）', '');
            } else {
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
        
        const topics = Array.from(topicMap.values());
        
        console.log(`加载专题: ${subject}/${version} -> ${topics.length}个`);
        res.json({ success: true, topics: topics });
    } catch (error) {
        console.error('加载专题失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
        
        html = html.replace(/<img[^>]*>/gi, '');
        html = html.replace(/<img[^>]*src="data:image[^"]*"[^>]*>/gi, '');
        
        const adPatterns = [/赠送.*?2000G/i, /2000G.*?学习资料/i, /扫码.*?关注/i, /公众号/i, /免费.*?领取/i];
        for (const pattern of adPatterns) {
            html = html.replace(new RegExp(`<p[^>]*>${pattern.source}[^<]*</p>`, 'gi'), '');
            html = html.replace(new RegExp(`<div[^>]*>${pattern.source}[^<]*</div>`, 'gi'), '');
        }
        
        html = html.replace(/<p>\s*<\/p>/gi, '');
        html = html.replace(/<div>\s*<\/div>/gi, '');
        
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
        
        html = html.replace(/(【答案】[^【]*?)(?=【|$)/g, (match) => {
            return `<div class="answer-box" style="background:#fff5f5; padding:10px 15px; margin:15px 0; border-radius:8px;">${match}</div>`;
        });
        html = html.replace(/(【解析】[^【]*?)(?=【|$)/g, (match) => {
            return `<div class="answer-box" style="background:#f0f7ff; padding:10px 15px; margin:15px 0; border-radius:8px;">${match}</div>`;
        });
        html = html.replace(/【答案】/g, '<strong style="color:#e74c3c;">【答案】</strong>');
        html = html.replace(/【解析】/g, '<strong style="color:#e74c3c;">【解析】</strong>');
        
        html = html.replace(/<table/g, '<table class="doc-table" style="border-collapse:collapse; width:100%; margin:16px 0;"');
        html = html.replace(/<th/g, '<th style="border:1px solid #ddd; padding:8px; background:#f5f5f5; text-align:center;"');
        html = html.replace(/<td/g, '<td style="border:1px solid #ddd; padding:8px;"');
        
        html = html.replace(/<ul>/g, '<ul style="margin:8px 0; padding-left:24px;">');
        html = html.replace(/<ol>/g, '<ol style="margin:8px 0; padding-left:24px;">');
        
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

router.get('/answer-sheet/:subject/:topicId', (req, res) => {
    const { subject, topicId } = req.params;
    const sheetDir = path.join(__dirname, '../../data/question_banks');
    
    const files = fs.readdirSync(sheetDir);
    const sheetFile = files.find(f => f.includes(subject) && f.includes('answer_sheet'));
    
    if (!sheetFile) {
        return res.status(404).json({ success: false, error: '答题卡不存在', files: files });
    }
    
    const sheetPath = path.join(sheetDir, sheetFile);
    res.sendFile(sheetPath);
});

// ========== 解析文档接口（真实解析） ==========
router.post('/parse', upload.single('file'), async (req, res) => {
    const file = req.file;
    const { pageStart, pageEnd, questionPattern, answerMarker, analysisMarker } = req.body;

    if (!file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const ansMarker = (answerMarker || '【答案】').trim();
    const anaMarker = (analysisMarker || '【解析】').trim();

    try {
        const filePath = file.path;
        const ext = path.extname(file.originalname).toLowerCase();
        let pages = [];

        if (ext === '.pdf') {
            pages = await parsePDFToPages(filePath);
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            pages = splitDocxPages(result.value);
        } else {
            throw new Error('Unsupported file format. Please upload PDF or DOCX.');
        }

        pages = pages.map(cleanText);

        const startPage = Math.max(parseInt(pageStart, 10) || 1, 1);
        const endPage = Math.min(parseInt(pageEnd, 10) || pages.length, pages.length);
        const selectedPages = pages.slice(startPage - 1, endPage);
        const targetText = selectedPages.join('\n\n');

        console.log(`Parse pages: ${startPage}-${endPage}, total pages: ${pages.length}`);
        console.log(`Target text length: ${targetText.length}`);
        console.log(`Question pattern: ${questionPattern || '(auto)'}, answer marker: ${ansMarker}, analysis marker: ${anaMarker}`);

        const questions = extractQuestions(targetText, {
            questionPattern,
            answerMarker: ansMarker,
            analysisMarker: anaMarker
        });

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({
            success: true,
            questions,
            totalQuestions: questions.length,
            pageStart: startPage,
            pageEnd: endPage,
            previewText: targetText.slice(0, 3000),
            message: `Parsed ${questions.length} questions`
        });
    } catch (error) {
        console.error('Parse failed:', error);
        if (file && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/parse-legacy', upload.single('file'), async (req, res) => {
    const file = req.file;
    const { pageStart, pageEnd, questionPattern, answerMarker, analysisMarker } = req.body;
    
    // 默认值
    const ansMarker = answerMarker || '【答案】';
    const anaMarker = analysisMarker || '【解析】';   
        
    try {
        const filePath = file.path;
        const ext = path.extname(file.originalname).toLowerCase();
        
        let fullText = '';
        
        if (ext === '.pdf') {
            fullText = await parsePDFToText(filePath);
            fullText = cleanText(fullText);
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            fullText = result.value;
        } else {
            throw new Error('不支持的文件格式');
        }
        
        // 1. 按页分割（简单模拟，实际 pdf2json 可以获取页码）
        const pages = fullText.split(/\f/);  // 分页符
        const startPage = parseInt(pageStart) || 1;
        const endPage = parseInt(pageEnd) || pages.length;
        
        // 只取指定页码范围
        let targetText = '';
        for (let i = startPage - 1; i < endPage && i < pages.length; i++) {
            targetText += pages[i] + '\n';
        }
        
        console.log(`页码范围: ${startPage}-${endPage}, 实际解析 ${pages.length} 页`);
        console.log(`目标文本长度: ${targetText.length}`);
        
        // 2. 提取题目
        const questions = [];
        
        // 匹配大题：数字．(年份·地区·类型)
        const mainPattern = /(\d+)．\s*\((\d{4}[^）]*?)\)\s*(.*?)(?=\n\d+．|$)/gs;
        let mainMatch;
        
        while ((mainMatch = mainPattern.exec(targetText)) !== null) {
            const mainNum = mainMatch[1];
            const year = mainMatch[2];
            const mainContent = mainMatch[3];
            
            // 提取小题 (1)、(2)、(3)
            const subPattern = /\((\d+)\)\s*(.*?)(?=\n\(|\n\d+．|$)/gs;
            let subMatch;
            
            while ((subMatch = subPattern.exec(mainContent)) !== null) {
                const subNum = subMatch[1];
                let content = subMatch[2].trim();
                content = content.replace(/\s+/g, ' ').trim();
                content = content.replace(/_{3,}/g, '______');
                
                // 提取答案（如果存在）
                let answer = '';
                const answerMatch = targetText.match(new RegExp(`${answerMark}([^${analysisMark}]+)`));
                if (answerMatch) {
                    answer = answerMatch[1].trim();
                }
                
                questions.push({
                    id: `q${mainNum}_${subNum}`,
                    mainId: mainNum,
                    subId: subNum,
                    year: year,
                    type: 'fill',
                    content: content,
                    sourceAnswer: answer,
                    finalAnswer: answer
                });
            }
        }
        
        // 清理临时文件
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        console.log(`成功解析 ${questions.length} 道题目`);
        
        res.json({
            success: true,
            questions: questions,
            totalQuestions: questions.length,
            message: `成功解析 ${questions.length} 道题目`
        });
        
    } catch (error) {
        console.error('解析失败:', error);
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// PDF 解析函数
function safeDecodePdfText(value) {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
}

function cleanText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u0000/g, '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function splitDocxPages(text) {
    const cleaned = cleanText(text);
    return cleaned ? cleaned.split(/\f+/) : [];
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function looksLikeRegex(value) {
    return /[\\^$.[\]()*+?{}|]/.test(value);
}

function buildMarkerRegex(marker) {
    if (!marker) return null;
    const compact = String(marker).replace(/\s+/g, '');
    const pattern = compact
        .split('')
        .map(char => {
            if (char === '【') return '[【\\[]';
            if (char === '】') return '[】\\]]';
            return escapeRegExp(char);
        })
        .join('\\s*');
    return new RegExp(pattern || escapeRegExp(marker), 'i');
}

function makeQuestionBoundaryRegex(questionPattern) {
    if (questionPattern && questionPattern.trim()) {
        const pattern = questionPattern.trim();
        if (looksLikeRegex(pattern)) {
            return new RegExp(pattern, 'gmi');
        }
        return new RegExp(`^\\s*${escapeRegExp(pattern)}[^\\n]*`, 'gmi');
    }

    return /^\s*(?:第?\s*[一二三四五六七八九十百\d]+\s*[题、.．)]|[（(]?\d{1,3}[）).．、])\s*/gmi;
}

function getQuestionNumber(block, index) {
    const firstLine = block.split('\n')[0] || '';
    const numberMatch = firstLine.match(/(?:第\s*)?([一二三四五六七八九十百\d]{1,4})\s*(?:题|[、.．)]|）)?/);
    return numberMatch ? numberMatch[1] : String(index + 1);
}

function splitQuestionBlocks(text, questionPattern) {
    const boundaryRe = makeQuestionBoundaryRegex(questionPattern);
    let matches = [...text.matchAll(boundaryRe)]
        .filter(match => match.index !== undefined)
        .map(match => ({ index: match.index, marker: match[0] }));

    if (matches.length === 0 && questionPattern && questionPattern.trim()) {
        const fallbackRe = makeQuestionBoundaryRegex('');
        matches = [...text.matchAll(fallbackRe)]
            .filter(match => match.index !== undefined)
            .map(match => ({ index: match.index, marker: match[0] }));
    }

    if (matches.length === 0) {
        return text.trim() ? [text.trim()] : [];
    }

    const blocks = [];
    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
        const block = text.slice(start, end).trim();
        if (block) blocks.push(block);
    }
    return blocks;
}

function splitByMarker(text, markerRegex) {
    if (!markerRegex) return { before: text, after: '' };
    const match = text.match(markerRegex);
    if (!match || match.index === undefined) return { before: text, after: '' };
    return {
        before: text.slice(0, match.index).trim(),
        after: text.slice(match.index + match[0].length).trim()
    };
}

function extractAnswerAndAnalysis(block, answerMarker, analysisMarker) {
    const answerSplit = splitByMarker(block, buildMarkerRegex(answerMarker));
    const analysisSplit = splitByMarker(answerSplit.after, buildMarkerRegex(analysisMarker));
    return {
        content: cleanText(answerSplit.before),
        sourceAnswer: cleanText(analysisSplit.before),
        analysis: cleanText(analysisSplit.after)
    };
}

function extractAnswerMap(text, answerMarker, analysisMarker) {
    const answerRe = buildMarkerRegex(answerMarker);
    const analysisRe = buildMarkerRegex(analysisMarker);
    const markerMatch = answerRe ? text.match(answerRe) : null;
    if (!markerMatch || markerMatch.index === undefined) return new Map();

    let answerSection = text.slice(markerMatch.index + markerMatch[0].length);
    const analysisMatch = analysisRe ? answerSection.match(analysisRe) : null;
    if (analysisMatch && analysisMatch.index !== undefined) {
        answerSection = answerSection.slice(0, analysisMatch.index);
    }

    const answerMap = new Map();
    const answerLineRe = /(?:^|\n)\s*(?:第\s*)?([一二三四五六七八九十百\d]{1,4})\s*(?:题|[、.．):：）])\s*([^\n]+)/g;
    for (const match of answerSection.matchAll(answerLineRe)) {
        answerMap.set(match[1], cleanText(match[2]));
    }
    return answerMap;
}

function inferQuestionType(content) {
    if (/[A-D][.．、)]/.test(content)) return 'choice';
    if (/_{2,}|____|（\s*）|\(\s*\)/.test(content)) return 'fill';
    return 'qa';
}

function extractQuestions(text, options) {
    const { questionPattern, answerMarker, analysisMarker } = options;
    const answerMap = extractAnswerMap(text, answerMarker, analysisMarker);
    const blocks = splitQuestionBlocks(text, questionPattern);

    return blocks.map((block, index) => {
        const number = getQuestionNumber(block, index);
        const extracted = extractAnswerAndAnalysis(block, answerMarker, analysisMarker);
        const sourceAnswer = extracted.sourceAnswer || answerMap.get(number) || '';
        const content = cleanText(extracted.content)
            .replace(new RegExp(`^\\s*${escapeRegExp(number)}\\s*[、.．):：）]?\\s*`), '')
            .replace(/_{3,}/g, '______');

        return {
            id: `q${index + 1}`,
            number: index + 1,
            originalNumber: number,
            type: inferQuestionType(content),
            content,
            sourceAnswer,
            aiAnswers: {},
            aiSuggestedAnswer: '',
            finalAnswer: sourceAnswer,
            analysis: extracted.analysis
        };
    }).filter(q => q.content || q.sourceAnswer);
}

function parsePDFToPages(filePath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on('pdfParser_dataError', (err) => {
            reject(err.parserError || err);
        });

        pdfParser.on('pdfParser_dataReady', (pdfData) => {
            if (!pdfData || !Array.isArray(pdfData.Pages)) {
                resolve([]);
                return;
            }

            const pages = pdfData.Pages.map((page) => {
                const textItems = [];
                for (const item of page.Texts || []) {
                    const value = (item.R || []).map(r => safeDecodePdfText(r.T || '')).join('');
                    if (value.trim()) {
                        textItems.push({ x: item.x || 0, y: item.y || 0, text: value });
                    }
                }

                textItems.sort((a, b) => (a.y - b.y) || (a.x - b.x));

                const lines = [];
                for (const item of textItems) {
                    const last = lines[lines.length - 1];
                    if (last && Math.abs(last.y - item.y) < 0.35) {
                        last.items.push(item);
                    } else {
                        lines.push({ y: item.y, items: [item] });
                    }
                }

                return lines.map(line => line.items
                    .sort((a, b) => a.x - b.x)
                    .map(item => item.text)
                    .join(' ')
                ).join('\n');
            });

            resolve(pages);
        });

        pdfParser.loadPDF(filePath);
    });
}

function parsePDFToText(filePath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        
        pdfParser.on('pdfParser_dataError', (err) => {
            reject(err);
        });
        
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
            // 提取所有文本内容
            let text = '';
            if (pdfData && pdfData.Pages) {
                for (const page of pdfData.Pages) {
                    if (page.Texts) {
                        for (const textItem of page.Texts) {
                            if (textItem.R) {
                                for (const line of textItem.R) {
                                    if (line.T) {
                                        text += decodeURIComponent(line.T) + ' ';
                                    }
                                }
                            }
                        }
                    }
                    text += '\n';
                }
            }
            resolve(text);
        });
        
        pdfParser.loadPDF(filePath);
    });
}

module.exports = router;
