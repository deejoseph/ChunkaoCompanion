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
    const { model_size = 'small', language = 'en' } = req.body;
    
    if (!file) {
        return res.status(400).json({ success: false, error: 'No audio file' });
    }
    
    const inputPath = file.path;
    const wavPath = inputPath + '.wav';
    
    console.log(`Whisper 转录: ${file.originalname}, 模型: ${model_size}, 语言: ${language}`);
    
    try {
        // 使用绝对路径调用 ffmpeg
        console.log('转换音频格式...');
        await execPromise(`"${FFMPEG_PATH}" -i "${inputPath}" -ar 16000 -ac 1 "${wavPath}" -y`);
        console.log('音频转换完成');
        
        // 调用 Python 脚本
        const pythonScript = path.join(__dirname, '../services/whisper_service.py');
        console.log('调用 Whisper...');
        
        const { stdout, stderr } = await execPromise(
            `"${PYTHON_PATH}" "${pythonScript}" "${wavPath}" ${model_size} ${language}`
        );
        
        if (stderr) {
            console.error('Whisper stderr:', stderr);
        }
        
        const result = JSON.parse(stdout);
        
        // 清理临时文件
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
        
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
        console.error('Whisper 转录失败:', error);
        // 清理临时文件
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
        
        res.status(500).json({ success: false, error: error.message });
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