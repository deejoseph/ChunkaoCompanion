const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

// Whisper 识别接口
router.post('/transcribe', upload.single('audio'), async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ success: false, error: 'No audio file' });
    }

    const filePath = file.path;
    const outputPath = filePath + '.wav';

    try {
        // 转换音频格式（WebM 转 WAV）
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -i "${filePath}" -ar 16000 -ac 1 "${outputPath}" -y`, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // 调用 Python Whisper 脚本
        const pythonScript = path.join(__dirname, '../services/whisper_transcribe.py');
        const result = await new Promise((resolve, reject) => {
            exec(`python "${pythonScript}" "${outputPath}"`, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve(stdout);
            });
        });

        // 清理临时文件
        fs.unlinkSync(filePath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        const transcript = JSON.parse(result);
        res.json({ success: true, text: transcript.text });
    } catch (error) {
        console.error('Whisper 识别失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;