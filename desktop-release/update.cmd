@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\YingceCanvas\update.ps1"
if errorlevel 1 pause
