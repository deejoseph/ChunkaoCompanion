const { exec } = require('child_process');
const path = require('path');

const pythonPath = 'C:\\Users\\deejo\\anaconda3\\envs\\pixel_ai\\python.exe';
const scriptPath = path.join(__dirname, '../scripts/ocr_texteller.py');
const imagePath = path.join(__dirname, 'formula.png');

const cmd = `"${pythonPath}" "${scriptPath}" "${imagePath}"`;
console.log('执行:', cmd);

exec(cmd, (error, stdout, stderr) => {
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
    if (error) {
        console.log('error:', error);
    }
});