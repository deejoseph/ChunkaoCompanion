const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const projectRoot = path.join(__dirname, '../..');
const pythonPath = 'C:\\Users\\deejo\\anaconda3\\envs\\pixel_ai\\python.exe';
const tempDir = path.join(__dirname, '../temp');
const uploadDir = path.join(__dirname, '../uploads');

for (const dir of [tempDir, uploadDir]) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function createStorage(destination) {
    return multer.diskStorage({
        destination: (req, file, cb) => cb(null, destination),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname) || '.png';
            const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `ocr-${suffix}${ext}`);
        }
    });
}

const tempUpload = multer({ storage: createStorage(tempDir) });
const savedUpload = multer({ storage: createStorage(uploadDir) });

function runPythonScript(scriptPath, imagePath, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };

        execFile(pythonPath, [scriptPath, imagePath], {
            cwd: projectRoot,
            timeout,
            env,
            windowsHide: true,
            encoding: 'utf8'
        }, (error, stdout, stderr) => {
            if (stderr) {
                console.log('OCR stderr:', stderr);
            }

            if (error) {
                reject(error);
                return;
            }

            const output = stdout.trim();
            if (!output) {
                reject(new Error('Python script produced no output'));
                return;
            }

            try {
                resolve(JSON.parse(output));
            } catch (parseError) {
                reject(new Error(`Failed to parse OCR output: ${parseError.message}`));
            }
        });
    });
}

router.post('/recognize', tempUpload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    const imagePath = req.file.path;
    const scriptPath = path.join(projectRoot, 'scripts/ocr_pix2tex.py');

    try {
        const result = await runPythonScript(scriptPath, imagePath, 120000);
        res.json({
            success: !!result.success,
            latex: result.latex || '',
            raw: result
        });
    } catch (error) {
        console.error('Formula OCR failed:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    }
});

router.post('/recognize-text', savedUpload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    const imagePath = req.file.path;
    const scriptPath = path.join(__dirname, '../scripts/ocr_paddle.py');

    try {
        const result = await runPythonScript(scriptPath, imagePath, 180000);
        res.json({
            success: !!result.success,
            text: result.text || '',
            blocks: result.blocks || [],
            savedFile: req.file.filename,
            savedPath: imagePath,
            raw: result
        });
    } catch (error) {
        console.error('Text OCR failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            savedFile: req.file.filename,
            savedPath: imagePath
        });
    }
});

module.exports = router;
