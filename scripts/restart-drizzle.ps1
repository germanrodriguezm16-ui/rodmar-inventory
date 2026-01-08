# Script para reiniciar solo Drizzle Studio
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Split-Path -Parent $scriptPath

Write-Host "Reiniciando Drizzle Studio..." -ForegroundColor Cyan

# Detener Drizzle
& "$scriptPath\stop-drizzle.ps1"

Start-Sleep -Seconds 2

# Iniciar Drizzle
Write-Host "Iniciando Drizzle Studio..." -ForegroundColor Green
Set-Location $rootPath
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Drizzle Studio' -ForegroundColor Magenta; npm run db:studio" -WindowStyle Minimized

Start-Sleep -Seconds 3

# Verificar
$drizzle = Get-NetTCPConnection -LocalPort 4983 -ErrorAction SilentlyContinue
if ($drizzle) {
    Write-Host "Drizzle Studio reiniciado correctamente (puerto 4983)" -ForegroundColor Green
} else {
    Write-Host "Drizzle Studio iniciando... (espera unos segundos)" -ForegroundColor Yellow
}

