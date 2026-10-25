@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -FeedRoot "https://github.com/yongchengjiao2-ctrl/yingce-desktop-releases/releases/latest/download"
if errorlevel 1 pause
