@echo off
cd /d "%~dp0"
git pull
start cmd /k "call venv\Scripts\activate.bat && python server.py %*"
exit