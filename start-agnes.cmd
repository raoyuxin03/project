@echo off
setlocal

set "PROJECT_DIR=D:\claudecode\agnes-ai-webapp\agnes-web"
set "LOG_FILE=%PROJECT_DIR%\agnes-start.log"
set "NODE_DIR=C:\Program Files\nodejs"
set "NPM_CMD=%NODE_DIR%\npm.cmd"
set "VITE_CMD=%PROJECT_DIR%\node_modules\.bin\vite.cmd"

if exist "%NODE_DIR%\node.exe" (
  set "PATH=%NODE_DIR%;%PATH%"
)

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo Failed to enter project directory: %PROJECT_DIR%
  pause
  exit /b 1
)

echo [%date% %time%] Starting Agnes AI Agent Canvas > "%LOG_FILE%"
echo Project: %PROJECT_DIR%
echo URL: http://localhost:3000/
echo.

if not exist "%NPM_CMD%" (
  for %%N in (npm.cmd) do set "NPM_CMD=%%~$PATH:N"
)

if not exist "%NPM_CMD%" (
  echo Node.js/npm was not found in PATH.
  echo Please install Node.js LTS from https://nodejs.org/
  echo Node.js/npm was not found in PATH. >> "%LOG_FILE%"
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  echo Installing dependencies... >> "%LOG_FILE%"
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo npm install failed.
    echo npm install failed. >> "%LOG_FILE%"
    pause
    exit /b 1
  )
)

echo Starting dev server. Keep this window open.
echo Starting dev server. >> "%LOG_FILE%"
echo.
echo The browser will open in a few seconds.
echo If the page says connection refused, wait 5 seconds and refresh.
echo.

start "" "%SystemRoot%\System32\cmd.exe" /c "timeout /t 3 /nobreak >nul && start "" "http://localhost:3000/""

if exist "%VITE_CMD%" (
  call "%VITE_CMD%" --host 0.0.0.0 --port 3000
) else (
  call "%NPM_CMD%" run dev -- --host 0.0.0.0 --port 3000
)

echo.
echo Dev server stopped with exit code %errorlevel%.
echo Dev server stopped with exit code %errorlevel%. >> "%LOG_FILE%"
pause
