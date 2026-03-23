@echo off
REM Build the Vite SPA (avoids PowerShell blocking npm.ps1 — uses npm.cmd).
cd /d "%~dp0frontend"
call npm.cmd run build
exit /b %ERRORLEVEL%
