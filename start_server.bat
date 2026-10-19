@echo off
title chitgit Local Backend & Web Dashboard
echo ========================================================
echo   chitgit AI Plagiarism Checker - Local Server
echo ========================================================
echo.
echo Starting Flask Server on http://localhost:5000 ...
echo Web Dashboard: http://localhost:5000/dashboard
echo API Health:    http://localhost:5000/api/health
echo.
echo Press Ctrl+C to stop the server anytime.
echo.
python server.py
pause
