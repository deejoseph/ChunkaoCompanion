const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// 使用绝对路径（从 where ffmpeg 得到的路径）
const FFMPEG_PATH = 'C:\\ffmpeg\\ffmpeg\\bin\\ffmpeg.exe';
const PYTHON_PATH = 'C:/Users/deejo/anaconda3/envs/pixel_ai/python.exe';

router.post('/transcribe', upload.single('audio'), async (req, res) => {
    const file = req.file;
    // 修复：添加默认值，防止 undefined
    const model_size = req.body.model_size || 'small';
    const language = req.body.language || 'en';
    
    if (!file) {
        return res.status(400).json({ success: false, error: 'No audio file' });
    }
    
    const inputPath = file.path;
    const wavPath = inputPath + '.wav';
    
    console.log(`Whisper 转录: ${file.originalname}, 模型: ${model_size}, 语言: ${language}`);
    
    try {
        // 1. 检查输入文件是否存在
        if (!fs.existsSync(inputPath)) {
            throw new Error(`输入文件不存在: ${inputPath}`);
        }
        
        // 2. 使用绝对路径调用 ffmpeg 转换
        console.log('转换音频格式...');
        const ffmpegCmd = `"${FFMPEG_PATH}" -i "${inputPath}" -ar 16000 -ac 1 "${wavPath}" -y`;
        console.log('执行命令:', ffmpegCmd);
        
        const { stdout: ffmpegStdout, stderr: ffmpegStderr } = await execPromise(ffmpegCmd);
        if (ffmpegStderr) {
            console.log('ffmpeg 输出:', ffmpegStderr);
        }
        
        if (!fs.existsSync(wavPath)) {
            throw new Error('ffmpeg 转换失败，未生成 wav 文件');
        }
        console.log('音频转换完成:', wavPath);
        
        // 3. 调用 Python 脚本
        const pythonScript = path.join(__dirname, '../services/whisper_service.py');
        console.log('Python 脚本路径:', pythonScript);
        
        // 检查 Python 脚本是否存在
        if (!fs.existsSync(pythonScript)) {
            throw new Error(`Python 脚本不存在: ${pythonScript}`);
        }
        
        // 构建命令
        const pythonCmd = `"${PYTHON_PATH}" "${pythonScript}" "${wavPath}" ${model_size} ${language}`;
        console.log('执行命令:', pythonCmd);
        
        const backendDir = path.join(__dirname, '..');
        console.log('工作目录:', backendDir);
        
        const { stdout, stderr } = await execPromise(pythonCmd, {
            cwd: backendDir,
            maxBuffer: 10 * 1024 * 1024, // 10MB 缓冲区
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',  // 强制 UTF-8 输出
                GLOG_minloglevel: '3',
                TF_CPP_MIN_LOG_LEVEL: '3'
            }
        });
        
        if (stderr) {
            console.log('Whisper stderr (可忽略):', stderr.substring(0, 200));
        }
        
        console.log('Python 原始输出 (前200字符):', stdout.substring(0, 200));
        
        // 解析 JSON - 过滤掉非 JSON 前缀（如警告、日志等）
        let jsonStart = -1;
        for (let i = 0; i < stdout.length; i++) {
            if (stdout[i] === '{' || stdout[i] === '[') {
                jsonStart = i;
                break;
            }
        }
        
        if (jsonStart === -1) {
            console.error('未找到 JSON 起始字符，原始输出:', stdout);
            throw new Error('Python 输出中没有找到有效的 JSON 起始字符');
        }
        
        const jsonString = stdout.substring(jsonStart);
        console.log('提取的 JSON (前300字符):', jsonString.substring(0, 300));
        
        let result;
        try {
            result = JSON.parse(jsonString);
        } catch (parseError) {
            console.error('JSON 解析失败:', parseError.message);
            console.error('问题字符串:', jsonString.substring(0, 500));
            throw new Error(`JSON 解析失败: ${parseError.message}`);
        }
        
        // 清理临时文件
        try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
        } catch (cleanError) {
            console.warn('清理临时文件失败:', cleanError);
        }
        
        console.log(`Whisper 转录完成: ${result.segments?.length || 0} 个片段`);
        console.log(`识别文本: ${result.text}`);
        
        res.json({
            success: true,
            text: result.text,
            segments: result.segments,
            language: result.language,
            duration: result.duration,
            engine: 'whisper'
        });
        
    } catch (error) {
        console.error('Whisper 转录失败:', error.message);
        console.error('错误堆栈:', error.stack);
        
        // 清理临时文件
        try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
        } catch (cleanError) {
            // 忽略清理错误
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

router.get('/models', (req, res) => {
    res.json({
        success: true,
        models: ['tiny', 'base', 'small', 'medium', 'large'],
        default: 'small'
    });
});

module.exports = router;