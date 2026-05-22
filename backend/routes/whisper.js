const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const { getWorkerStatus, transcribeWithWorker } = require('../services/whisperWorker');
const execPromise = util.promisify(exec);

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// 使用绝对路径（从 where ffmpeg 得到的路径）
const FFMPEG_PATH = 'C:\\ffmpeg\\ffmpeg\\bin\\ffmpeg.exe';
const PYTHON_PATH = process.env.WHISPER_PYTHON_PATH || 'C:/Users/deejo/anaconda3/envs/pixel_ai/python.exe';

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
        
        const result = await transcribeWithWorker({
            audioPath: wavPath,
            modelSize: model_size,
            language
        });
        
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
            engine: 'whisper',
            model_size: result.model_size || model_size
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

router.get('/status', (req, res) => {
    res.json({
        success: true,
        worker: getWorkerStatus()
    });
});

router.get('/models', (req, res) => {
    res.json({
        success: true,
        models: ['tiny', 'base', 'small', 'medium', 'large'],
        default: 'small'
    });
});

module.exports = router;
