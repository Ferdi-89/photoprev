@echo off
title Hentikan Server RTFTP Studio
color 0c

echo ========================================================
echo   Menghentikan Server RTFTP Studio (Port 3000)...
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($pids) { foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Write-Output ('Proses PID ' + $p + ' berhasil dihentikan.') } } else { Write-Output 'Tidak ada server yang sedang berjalan di port 3000.' }"

echo.
echo Server selesai dihentikan.
timeout /t 2 >nul
