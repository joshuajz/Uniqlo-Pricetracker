@echo off
REM Uniqlo Price Tracker - Daily Scraper
REM
REM To schedule with Windows Task Scheduler:
REM 1. Open Task Scheduler (taskschd.msc)
REM 2. Create Basic Task
REM 3. Set trigger to Daily at desired time
REM 4. Action: Start a program, select this .bat file

cd /d "%~dp0"

echo ==========================================
echo Scraper started at %date% %time%
echo ==========================================

uv run main.py

echo ==========================================
echo Scraper finished at %date% %time%
echo ==========================================
