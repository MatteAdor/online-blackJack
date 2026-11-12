@echo off
title Caricamento Blackjack su GitHub
echo ========================================================
echo   CARICAMENTO SU GITHUB: MatteAdor/blackjack
echo ========================================================
echo.
echo Invio dei file in corso a https://github.com/MatteAdor/blackjack.git...
echo (Se richiesto, effettua il login nel browser con il tuo account GitHub)
echo.

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   [OK] Caricamento completato con successo!
    echo ========================================================
    echo.
    echo Ora attiva GitHub Pages da qui:
    echo https://github.com/MatteAdor/blackjack/settings/pages
    echo.
    echo Aprendo la pagina di configurazione...
    start "" "https://github.com/MatteAdor/blackjack/settings/pages"
) else (
    echo.
    echo [!] Errore durante il caricamento. 
    echo Assicurati di aver prima creato il repository vuoto 'blackjack' su:
    echo https://github.com/new?name=blackjack
)

pause
