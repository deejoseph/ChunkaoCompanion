const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 使用绝对路径的临时目录
const uploadDir = path.join(__dirname, '../temp');

// 确保目录存在
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('创建临时目录:', uploadDir);
}

// 配置 multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const ocrModel = req.body.model || 'pix2tex';  // pix2tex 或 llava

if (ocrModel === 'llava') {
    scriptPath = path.join(__dirname, '../../scripts/ocr_llava.py');
} else {
    scriptPath = path.join(__dirname, '../../scripts/ocr_pix2tex.py');
}

// Python 环境配置
const pythonPath = 'C:\\Users\\deejo\\anaconda3\\envs\\pixel_ai\\python.exe';
// 改用 pix2tex 脚本
const scriptPath = path.join(__dirname, '../../scripts/ocr_pix2tex.py');
const projectRoot = path.join(__dirname, '../..');

function runOcrScript(imagePath) {
    return new Promise((resolve, reject) => {
        const cmd = `"${pythonPath}" "${scriptPath}" "${imagePath}"`;
        console.log('执行命令:', cmd);
        
        exec(cmd, { cwd: projectRoot, timeout: 60000 }, (error, stdout, stderr) => {
            console.log('stdout:', stdout);
            console.log('stderr:', stderr);
            
            if (error) {
                reject(error);
                return;
            }
            
            const trimmedStdout = stdout.trim();
            if (!trimmedStdout) {
                reject(new Error('Python 脚本没有输出'));
                return;
            }
            
            try {
                const result = JSON.parse(trimmedStdout);
                resolve(result);
            } catch (e) {
                reject(e);
            }
        });
    });
}

router.post('/recognize', upload.single('image'), async (req, res) => {
    console.log('收到OCR请求');
    
    if (!req.file) {
        return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    
    const imagePath = req.file.path;
    console.log('保存图片:', imagePath);
    console.log('文件大小:', req.file.size);
    console.log('文件是否存在:', fs.existsSync(imagePath));
    
    try {
        const result = await runOcrScript(imagePath);
        console.log('OCR结果:', result);
        
        // 删除临时文件
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
        
        res.json({
            success: true,
            latex: result.latex,
            raw: result
        });
    } catch (error) {
        console.error('OCR失败:', error);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;