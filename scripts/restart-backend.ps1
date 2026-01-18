# Script para reiniciar solo el servidor backend
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Split-Path -Parent $scriptPath

Write-Host "Reiniciando servidor Backend..." -ForegroundColor Cyan

# Detener backend
& "$scriptPath\stop-backend.ps1"

Start-Sleep -Seconds 2

# Iniciar backend
Write-Host "Iniciando servidor Backend..." -ForegroundColor Green
Set-Location $rootPath
$cmd = @"
if (-not \$env:PERMISSIONS_SYNC_ON_BOOT -or \$env:PERMISSIONS_SYNC_ON_BOOT.Trim() -eq '') { \$env:PERMISSIONS_SYNC_ON_BOOT = 'off' }
if (-not \$env:PERMISSIONS_SYNC_VERBOSE -or \$env:PERMISSIONS_SYNC_VERBOSE.Trim() -eq '') { \$env:PERMISSIONS_SYNC_VERBOSE = '0' }
Write-Host 'Servidor Backend' -ForegroundColor Green;
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd -WindowStyle Minimized

Start-Sleep -Seconds 3

# Verificar
$backend = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($backend) {
    Write-Host "Backend reiniciado correctamente (puerto 5000)" -ForegroundColor Green
} else {
    Write-Host "Backend iniciando... (espera unos segundos)" -ForegroundColor Yellow
}

