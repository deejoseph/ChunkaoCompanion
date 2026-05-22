const { spawn } = require('child_process');
const path = require('path');

const PYTHON_PATH = process.env.WHISPER_PYTHON_PATH || 'C:/Users/deejo/anaconda3/envs/pixel_ai/python.exe';
const WORKER_PATH = path.join(__dirname, 'whisper_worker.py');
const REQUEST_TIMEOUT_MS = Number(process.env.WHISPER_TIMEOUT_MS || 120000);

let worker = null;
let nextRequestId = 1;
const pending = new Map();

function rejectAllPending(error) {
    for (const { reject, timer } of pending.values()) {
        clearTimeout(timer);
        reject(error);
    }
    pending.clear();
}

function startWorker() {
    if (worker && !worker.killed) {
        return worker;
    }

    worker = spawn(PYTHON_PATH, [WORKER_PATH], {
        cwd: path.join(__dirname, '..'),
        env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8',
            GLOG_minloglevel: '3',
            TF_CPP_MIN_LOG_LEVEL: '3'
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutBuffer = '';

    worker.stdout.on('data', (chunk) => {
        stdoutBuffer += chunk.toString('utf8');
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;

            let message;
            try {
                message = JSON.parse(line);
            } catch (error) {
                console.warn('Whisper worker 非 JSON 输出:', line.substring(0, 200));
                continue;
            }

            const request = pending.get(message.id);
            if (!request) continue;

            clearTimeout(request.timer);
            pending.delete(message.id);

            if (message.success) {
                request.resolve(message.result);
            } else {
                request.reject(new Error(message.error || 'Whisper worker failed'));
            }
        }
    });

    worker.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8').trim();
        if (text) {
            console.warn('Whisper worker stderr:', text.substring(0, 300));
        }
    });

    worker.on('exit', (code, signal) => {
        const error = new Error(`Whisper worker exited: code=${code}, signal=${signal}`);
        worker = null;
        rejectAllPending(error);
    });

    worker.on('error', (error) => {
        worker = null;
        rejectAllPending(error);
    });

    return worker;
}

function transcribeWithWorker({ audioPath, modelSize = 'small', language = 'en' }) {
    const activeWorker = startWorker();
    const id = nextRequestId++;

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error('Whisper 转录超时'));
        }, REQUEST_TIMEOUT_MS);

        pending.set(id, { resolve, reject, timer });

        activeWorker.stdin.write(JSON.stringify({
            id,
            audio_path: audioPath,
            model_size: modelSize,
            language
        }) + '\n', 'utf8');
    });
}

function getWorkerStatus() {
    return {
        running: !!worker && !worker.killed,
        pending: pending.size,
        pythonPath: PYTHON_PATH,
        workerPath: WORKER_PATH
    };
}

module.exports = {
    getWorkerStatus,
    transcribeWithWorker
};
