@echo off
chcp 65001 >nul
title CookBook AI
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Install Node.js and restart this launcher.
    pause
    exit /b 1
)
if not exist "backend\.env" (
    echo ERROR: Configure backend\.env using backend\.env.example first.
    pause
    exit /b 1
)
if not exist "backend\node_modules" goto missing_dependencies
if not exist "frontend\node_modules" goto missing_dependencies
echo Starting CookBook AI. Wait for both servers to be ready.
echo Open http://127.0.0.1:5173 in your browser.
echo Press Ctrl+C in this window to stop the application.
call npm.cmd start
if errorlevel 1 (
    echo Startup failed. See the error above.
    pause
    exit /b 1
)
exit /b 0
:missing_dependencies
echo ERROR: Run npm.cmd --prefix backend ci and npm.cmd --prefix frontend ci first.
pause
exit /b 1
