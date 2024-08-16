@echo off
cd /d "C:\Users\Invigo\Desktop\Invigo-Server"
git pull
python setup.py
start cmd /k "call venv\Scripts\activate.bat && python server.py %*"
exit