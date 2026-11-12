Write-Host "========================================================" -ForegroundColor Yellow
Write-Host "  💎 ROYAL CASINO BLACKJACK - MULTIPLAYER LAN 💎" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Avvio del server in corso..." -ForegroundColor Green

$pyExe = "py"
if (Test-Path "c:\msys64\ucrt64\bin\python.exe") {
    $pyExe = "c:\msys64\ucrt64\bin\python.exe"
}

Start-Process "http://localhost:8080"
& $pyExe server.py
