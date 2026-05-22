@echo off
echo ========================================
echo   春考伴学 - 本地AI学习助手
echo ========================================
echo.

echo [1/4] 清理端口占用...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    echo 结束进程 %%a
    taskkill /F /PID %%a 2>nul
)
timeout /t 1 /nobreak >nul

echo [2/4] 检查Ollama服务...
ollama list > nul 2>&1
if errorlevel 1 (
    echo 错误: Ollama未运行，请先启动Ollama
    pause
    exit /b
)
echo Ollama服务正常

echo [3/4] 启动后端服务...
cd backend
start /b node app.js
cd ..

echo [4/4] 启动前端...
cd frontend
start /b npm run dev
cd ..

echo.
echo 服务已启动！
echo 前端地址: http://localhost:5173
echo 后端地址: http://localhost:3001
echo.
echo 按任意键关闭此窗口（服务会继续运行）...
pause > nul