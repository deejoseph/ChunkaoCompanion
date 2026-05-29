@echo off
chcp 65001 >nul
title Super AI - qwen3.6:27b

echo.
echo ========================================
echo   Starting qwen3.6:27b Model
echo ========================================
echo.

:: Check if Ollama is running
tasklist /fi "imagename eq ollama.exe" | find /i "ollama" >nul 2>&1
if errorlevel 1 (
    echo Ollama service not running, attempting to start...
    set OLLAMA_BIN=C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama.exe
    if not exist "!OLLAMA_BIN!" (
        echo [Error] Ollama not found at !OLLAMA_BIN!
        echo Please install Ollama first: https://ollama.ai
        timeout /t 5 >nul
        exit /b 1
    )
    start "" "!OLLAMA_BIN!" serve
    timeout /t 3 >nul
)

echo Starting qwen3.6:27b model...
echo First run may take some time as the model downloads...
echo.

:: Run ollama with qwen3.6:27b
ollama run qwen3.6:27b

endlocal
