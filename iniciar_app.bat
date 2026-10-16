@echo off
title Batch Video Studio AI
color 0A

cd /d "%~dp0"

echo =========================================================
echo   BATCH VIDEO STUDIO AI - INICIANDO APLICACION LOCAL
echo =========================================================
echo.
echo  [1/2] Liberando procesos anteriores y verificando puertos...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1

echo.
echo  [2/2] Arrancando servidores y abriendo navegador...
echo  - Interfaz Web: http://localhost:5173
echo  - Servidor Backend: http://localhost:3001
echo.
echo  (Presiona Ctrl + C para detener la aplicacion)
echo =========================================================
echo.

start "" "http://localhost:5173"

npm run dev

pause
