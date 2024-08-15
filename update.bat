@echo off
cd /d "C:\Users\Invigo\Desktop\Invigo-Server"
git pull
C:\Users\Invigo\AppData\Local\Programs\Python\Python312\python.exe setup.py
start cmd /k "call venv\Scripts\activate.bat && python server.py %*"
exit