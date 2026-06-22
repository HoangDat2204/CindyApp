@echo off
title Rucao SmartEntry - Backend Server
echo ===================================================
echo     Khoi dong he thong Rucao SmartEntry...
echo ===================================================

:: Tat tinh nang MKLDNN de tranh loi xung dot CPU
set FLAGS_use_mkldnn=0
set FLAGS_enable_mkldnn=0

:: Di chuyển vào thư mục backend
cd backend

:: Gọi python từ môi trường embedded để chạy FastAPI
.\python_runtime\python.exe main.py

pause