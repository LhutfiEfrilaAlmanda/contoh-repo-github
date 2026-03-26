@echo off
echo ==========================================
echo    PORTAL CSR - STARTUP
echo ==========================================
echo.
echo [1/3] Mematikan proses lama...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Memulai Backend dan Frontend...
echo.

REM Jalankan backend di jendela terpisah (tidak akan hilang)
start "PORTAL CSR - Backend" cmd /k "cd /d D:\PORTAL CSR && node backend/server.js"

REM Tunggu backend siap
timeout /t 3 /nobreak >nul

REM Jalankan frontend di jendela terpisah
start "PORTAL CSR - Frontend" cmd /k "cd /d D:\PORTAL CSR\frontend && npm run dev"

REM Tunggu frontend siap
timeout /t 5 /nobreak >nul

echo [3/3] Membuka browser...
start http://localhost:5173

echo.
echo ==========================================
echo    PORTAL CSR SUDAH BERJALAN!
echo    Backend:  http://localhost:5000
echo    Frontend: http://localhost:5173
echo ==========================================
echo.
echo Jangan tutup jendela CMD Backend dan Frontend!
echo Jendela ini boleh ditutup.
echo.
pause
