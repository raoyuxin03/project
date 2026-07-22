@echo off
chcp 65001 >nul
title Agnes AI Agent Canvas

cd /d "%~dp0"

echo.
echo ========================================
echo   Agnes AI Agent Canvas
echo ========================================
echo.
echo 项目目录：%cd%
echo 本地地址：http://localhost:3000/
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js / npm。
  echo 请先安装 Node.js LTS：https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 首次启动，正在安装依赖...
  npm install
  if errorlevel 1 (
    echo.
    echo 依赖安装失败，请检查网络或 npm 环境。
    pause
    exit /b 1
  )
)

echo 正在打开浏览器...
start "" "http://localhost:3000/"
echo.
echo 正在启动服务，窗口不要关闭。
echo 如果 3000 端口被占用，请先关闭旧的 Agnes AI 窗口。
echo.
npm run dev -- --host 0.0.0.0 --port 3000

pause
