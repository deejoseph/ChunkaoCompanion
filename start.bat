@echo off
setlocal enabledelayedexpansion
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
echo Step 1 - Starting Whisper Worker...
start "Whisper" cmd /k "cd /d backend && node services/whisperWorker.js"

timeout /t 2 >nul

:: 启动后端
echo Step 2 - Starting Backend Service on port 3001...
start "Backend" cmd /k "cd /d backend && node app.js"

timeout /t 2 >nul

:: 启动前端
echo Step 3 - Starting Frontend Service on port 3000...
start "Frontend" cmd /k "cd /d frontend && npm run dev"

timeout /t 2 >nul

:: 启动 Ollama（如果未运行）
echo Step 4 - Checking Ollama Service...
tasklist /fi "imagename eq Ollama.exe" | find /i "Ollama" >nul 2>&1
if errorlevel 1 (
    echo Ollama service not running, starting it...
    start "Ollama" "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\Ollama.exe"
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
endlocal