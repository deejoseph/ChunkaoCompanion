const { exec } = require('child_process');
const path = require('path');

const pythonPath = 'C:\\Users\\deejo\\anaconda3\\envs\\pixel_ai\\python.exe';
const scriptPath = path.join(__dirname, '../scripts/ocr_texteller.py');
const imagePath = path.join(__dirname, 'formula.png');
const projectRoot = path.join(__dirname, '..');

const cmd = `"${pythonPath}" "${scriptPath}" "${imagePath}"`;
console.log('执行命令:', cmd);
console.log('工作目录:', projectRoot);

exec(cmd, { cwd: projectRoot }, (error, stdout, stderr) => {
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
    console.log('error:', error);
});