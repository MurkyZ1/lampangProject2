@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =====================================
echo   Lampang Plookdee - React Frontend
echo =====================================
where node >nul 2>nul || (echo Please install Node.js first: https://nodejs.org/ & pause & exit /b 1)
call npm install
if errorlevel 1 (echo npm install failed. Check internet connection. & pause & exit /b 1)
call npm run dev
pause
