@echo off
title Rucao SmartEntry - Launcher

:: Tat tinh nang MKLDNN de tranh loi xung dot CPU cho PaddleOCR
set FLAGS_use_mkldnn=0
set FLAGS_enable_mkldnn=0

:: 1. Kiem tra va khoi dong Backend FastAPI (chi bo qua neu dang co tien trinh LISTENING)
netstat -ano | findstr :8000 | findstr LISTENING >NUL
if "%ERRORLEVEL%"=="0" (
    echo Backend is already running and listening on port 8000.
) else (
    echo Starting Backend...
    start /D "Backend" /B "" "python_runtime\python.exe" -m uvicorn main:app --reload
)

:: Cho 3 giay de Backend san sang
timeout /t 3 /nobreak >nul

:: 2. Khoi dong Giao dien Dashboard (Chay dong bo de cho den khi nguoi dung tat)
if exist "frontend\dashboard.exe" (
    "frontend\dashboard.exe"
) else (
    echo Loi: Khong tim thay file "frontend\dashboard.exe".
    pause
    exit /b
)

:: 3. Tu dong don dep triet de: Dong ca tien trinh cha (reloader) va con (worker) cua uvicorn
wmic process where "name='python.exe' and ExecutablePath like '%%python_runtime%%'" call terminate >nul 2>&1

:: Don dep du phong theo PID cua port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

exit
