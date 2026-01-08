# Script para reiniciar solo el servidor frontend
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Split-Path -Parent $scriptPath

Write-Host "Reiniciando servidor Frontend..." -ForegroundColor Cyan

# Detener frontend
& "$scriptPath\stop-frontend.ps1"

Start-Sleep -Seconds 2

# Iniciar frontend
Write-Host "Iniciando servidor Frontend..." -ForegroundColor Green
Set-Location "$rootPath\client"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Servidor Frontend' -ForegroundColor Cyan; npm run dev" -WindowStyle Minimized

Start-Sleep -Seconds 5

# Verificar
$frontend = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($frontend) {
    Write-Host "Frontend reiniciado correctamente (puerto 5173)" -ForegroundColor Green
} else {
    Write-Host "Frontend iniciando... (espera unos segundos)" -ForegroundColor Yellow
}

