@echo off
cd /d "%~dp0"
git pull
python setup.py
exit