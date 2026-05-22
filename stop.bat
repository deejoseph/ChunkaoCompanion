@echo off
chcp 65001 >nul
title 春考伴学 - 停止服务

echo ========================================
echo   春考伴学项目 - 停止服务
echo ========================================
echo.

:: 查找并终止后端进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo 终止后端进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

:: 查找并终止前端进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo 终止前端进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

:: 终止 Node.js 相关进程（谨慎使用）
taskkill /F /IM node.exe >nul 2>&1

echo.
echo %GREEN%服务已停止%RESET%
echo.
pause