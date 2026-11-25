@echo off
cd /d "%~dp0"
if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  call npm --prefix frontend install
)
echo Installing backend dependencies...
call py -m pip install -r backend\requirements.txt
start "Lampang Backend" cmd /k "cd backend && py -m uvicorn main:app --port 8000"
start "Lampang Frontend" cmd /k "npm run dev:frontend"
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000/docs
pause
