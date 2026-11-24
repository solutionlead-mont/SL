@echo off
cd /d "%~dp0"
echo.
echo  Demarrage de l'estimateur...
echo  Admin : http://localhost:3000/admin
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000/admin'"
node server.js
echo.
echo  Serveur arrete.
pause
