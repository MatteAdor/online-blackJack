@echo off
title Royal Casino Blackjack - Multiplayer LAN Server
echo ========================================================
echo   💎 ROYAL CASINO BLACKJACK - MULTIPLAYER LAN 💎
echo ========================================================
echo.
echo Avvio del server di gioco in corso...
echo.

set "PY_EXE=py"
if exist "c:\msys64\ucrt64\bin\python.exe" (
    set "PY_EXE=c:\msys64\ucrt64\bin\python.exe"
)

start "" "http://localhost:8080"
%PY_EXE% server.py

pause
