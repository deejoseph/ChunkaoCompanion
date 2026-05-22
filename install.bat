@echo off
chcp 65001 >nul
title 春考伴学 - 一键安装脚本

echo.
echo ========================================
echo   春考伴学项目 - 一键安装
echo ========================================
echo.

:: 获取脚本所在目录
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: ========== 1. 检查 Node.js ==========
echo [1/6] 检查 Node.js 环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js
    echo.
    echo 请手动安装 Node.js 18+ 版本
    echo 下载地址: https://nodejs.org/
    echo.
    echo 安装完成后，重新运行此脚本
    pause
    exit /b 1
)
for /f "tokens=1" %%i in ('node --version') do echo [OK] Node.js %%i

:: ========== 2. 检查 npm ==========
echo [2/6] 检查 npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 npm
    echo 请重新安装 Node.js
    pause
    exit /b 1
)
for /f "tokens=1" %%i in ('npm --version') do echo [OK] npm %%i

:: ========== 3. 检查 Ollama ==========
echo [3/6] 检查 Ollama...
ollama --version >nul 2>&1
if errorlevel 1 (
    echo [警告] 未检测到 Ollama
    echo AI 助教功能将不可用
    echo 请从 https://ollama.com/download 下载安装
    echo.
) else (
    for /f "tokens=2" %%i in ('ollama --version') do echo [OK] Ollama %%i
)

:: ========== 4. 安装后端依赖 ==========
echo [4/6] 安装后端依赖...
cd /d "%PROJECT_DIR%backend"
if exist node_modules (
    echo 后端依赖已存在，跳过安装
) else (
    echo 正在安装后端依赖（可能需要1-2分钟）...
    call npm install --silent
    if errorlevel 1 (
        echo [错误] 后端依赖安装失败
        echo 请手动执行: cd backend ^&^& npm install
        pause
        exit /b 1
    )
)
echo [OK] 后端依赖安装完成

:: ========== 5. 安装前端依赖 ==========
echo [5/6] 安装前端依赖...
cd /d "%PROJECT_DIR%frontend"
if exist node_modules (
    echo 前端依赖已存在，跳过安装
) else (
    echo 正在安装前端依赖（可能需要2-3分钟）...
    call npm install --silent
    if errorlevel 1 (
        echo [错误] 前端依赖安装失败
        echo 请手动执行: cd frontend ^&^& npm install
        pause
        exit /b 1
    )
)

:: 安装 Markdown 渲染插件（必需）
echo 检查 Markdown 插件...
call npm install remark-gfm rehype-katex remark-math --silent 2>nul
echo [OK] 前端依赖安装完成

:: ========== 6. 创建必要目录 ==========
echo [6/6] 创建必要目录...
cd /d "%PROJECT_DIR%"
if not exist data mkdir data
if not exist data\docs mkdir data\docs
if not exist backend\uploads mkdir backend\uploads
if not exist backup mkdir backup
echo [OK] 目录创建完成

:: ========== 完成 ==========
echo.
echo ========================================
echo   安装完成！
echo ========================================
echo.
echo 启动方法：
echo   双击 start.bat 启动服务
echo   浏览器访问 http://localhost:3000
echo.
echo 如果启动失败，请参考 docs\安装指南.md
echo.
pause