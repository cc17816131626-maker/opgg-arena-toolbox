@echo off
REM Windows 双击启动：双击这个文件即可。
cd /d "%~dp0"
node scripts\start.mjs
echo.
pause
