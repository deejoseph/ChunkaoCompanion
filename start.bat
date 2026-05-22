@echo off
chcp 65001 >nul
title 春考伴学 - 启动服务

echo.
echo ========================================
echo   春考伴学项目 - 启动服务
echo ========================================
echo.

cd /d "%~dp0"

:: 检查依赖
if not exist "backend\node_modules" (
    echo [错误] 后端依赖未安装
    echo 请先运行 install.bat 安装依赖
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [错误] 前端依赖未安装
    echo 请先运行 install.bat 安装依赖
    pause
    exit /b 1
)

:: 启动 Whisper Worker（精准模式语音识别）
echo [1/4] 启动 Whisper Worker...
start "春考伴学-Whisper" cmd /k "cd backend && echo Whisper Worker 启动中... && node services/whisperWorker.js"

timeout /t 2 >nul

:: 启动后端
echo [2/4] 启动后端服务 (http://localhost:3001)...
start "春考伴学-后端" cmd /k "cd backend && echo 后端服务启动中... && node app.js"

timeout /t 2 >nul

:: 启动前端
echo [3/4] 启动前端服务 (http://localhost:3000)...
start "春考伴学-前端" cmd /k "cd frontend && echo 前端服务启动中... && npm run dev"

:: 启动 Ollama（如果未运行）
echo [4/4] 检查 Ollama 服务...
curl -s http://localhost:11434 >nul 2>&1
if errorlevel 1 (
    echo Ollama 服务未运行，正在尝试启动...
    start "" "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\Ollama.exe"
)

echo.
echo ========================================
echo   服务启动中...
echo   前端: http://localhost:3000
echo   后端: http://localhost:3001
echo   Whisper Worker: 已启动（用于精准模式）
echo ========================================
echo.
echo 按任意键退出（服务将继续运行）
pause >nul