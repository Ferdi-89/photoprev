@echo off
setlocal
title Buat Shortcut Desktop RTFTP Studio
color 0a

echo ========================================================
echo   Membuat Shortcut Desktop RTFTP Studio...
echo ========================================================

set "APP_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dir = $env:APP_DIR;" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$desktop = [Environment]::GetFolderPath('Desktop');" ^
  "$shortcut = $ws.CreateShortcut((Join-Path $desktop 'RTFTP Studio.lnk'));" ^
  "$shortcut.TargetPath = 'wscript.exe';" ^
  "$shortcut.Arguments = '\"' + (Join-Path $dir 'run.vbs') + '\"';" ^
  "$shortcut.WorkingDirectory = $dir;" ^
  "$shortcut.IconLocation = $env:SystemRoot + '\System32\imageres.dll,67';" ^
  "$shortcut.Description = 'RTFTP Studio Photo Preview & Selection';" ^
  "$shortcut.Save()"

if %errorlevel% equ 0 (
    echo.
    echo [SUKSES] Shortcut "RTFTP Studio" telah dibuat di Desktop!
    echo Client sekarang bisa langsung double-click icon di Desktop
    echo tanpa perlu membuka CMD atau mengetik perintah apapun.
) else (
    echo.
    echo [GAGAL] Gagal membuat shortcut di Desktop.
)

echo.
pause
