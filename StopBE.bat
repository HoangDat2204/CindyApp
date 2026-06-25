@echo off
title Rucao SmartEntry - Stop Backend
echo ===================================================
echo     Dang dung cac tien trinh Backend...
echo ===================================================

:: Dung moi python.exe tu thu muc python_runtime (reloader & worker)
powershell -Command "Get-Process | Where-Object { $_.Path -like '*python_runtime*' } | Stop-Process -Force" >nul 2>&1

:: Giai phong cong 8000 neu con sot
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo Da tat Backend thanh cong!
ping 127.0.0.1 -n 3 >nul
exit
