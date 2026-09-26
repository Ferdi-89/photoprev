@echo off
title RTFTP Studio - Bagikan Link ke Beta Tester Online
color 0b

echo ===================================================================
echo   📸 RTFTP Studio - Public Tunnel untuk Beta Tester
echo ===================================================================
echo   Script ini membuat link HTTPS publik yang aman dan instan
echo   agar Beta Tester di luar studio (HP / Tablet / Laptop)
echo   bisa mengakses PhotoPrev tanpa perlu install apapun.
echo ===================================================================
echo.

:: 1. Periksa apakah server sudah aktif di port 3000
netstat -aon | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo [INFO] Server belum berjalan. Memulai server RTFTP di background...
    start /b node server.js
    timeout /t 3 >nul
) else (
    echo [OK] Server RTFTP sudah aktif di port 3000.
)

echo.
echo ===================================================================
echo   Membuat Link Online Publik melalui Localtunnel...
echo ===================================================================
echo   Salin URL HTTPS di bawah ini dan kirim ke Beta Tester Anda!
echo   (Tekan Ctrl+C untuk menghentikan akses publik kapan saja)
echo ===================================================================
echo.

npx localtunnel --port 3000
