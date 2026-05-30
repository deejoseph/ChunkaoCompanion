const fs = require('fs');
const http = require('http');
const path = require('path');

const out = path.join(__dirname, '..', '..', 'temp_test_image.png');
const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
fs.writeFileSync(out, Buffer.from(b64, 'base64'));

const boundary = '----NodeFormBoundary' + Date.now();
const bankId = 'test_chinese_sample';
const questionId = 'q1';
const fileBuffer = fs.readFileSync(out);
const filename = path.basename(out);

const part = [];
function addField(name, value) {
  part.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
}
function addFile(name, filename, buffer) {
  part.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`));
  part.push(buffer);
  part.push(Buffer.from('\r\n'));
}

addField('bankId', bankId);
addField('questionId', questionId);
addFile('file', filename, fileBuffer);
part.push(Buffer.from(`--${boundary}--\r\n`));

const body = Buffer.concat(part);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/banks/upload-asset',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': body.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP', res.statusCode);
    console.log('RESPONSE:', data);
  });
});
req.on('error', err => console.error('REQ ERR', err));
req.write(body);
req.end();
