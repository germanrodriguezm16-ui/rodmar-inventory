# Script para solucionar problemas comunes
Write-Host "Solucionando problemas..." -ForegroundColor Cyan
Write-Host ""

# 1. Detener procesos en puerto 5000
Write-Host "1. Deteniendo procesos en puerto 5000..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($processes) {
    foreach ($procId in $processes) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "   Proceso $procId detenido" -ForegroundColor Green
    }
} else {
    Write-Host "   No hay procesos en puerto 5000" -ForegroundColor Gray
}
Write-Host ""

# 2. Verificar dotenv
Write-Host "2. Verificando dotenv..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules\dotenv")) {
    Write-Host "   Instalando dotenv..." -ForegroundColor Cyan
    npm install dotenv
} else {
    Write-Host "   dotenv ya instalado" -ForegroundColor Green
}
Write-Host ""

# 3. Verificar .env
Write-Host "3. Verificando archivo .env..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $dbUrl = Get-Content .env | Select-String "DATABASE_URL"
    if ($dbUrl) {
        Write-Host "   .env existe y tiene DATABASE_URL" -ForegroundColor Green
    } else {
        Write-Host "   .env existe pero no tiene DATABASE_URL" -ForegroundColor Red
    }
} else {
    Write-Host "   .env no existe" -ForegroundColor Red
}
Write-Host ""

Write-Host "Listo! Ahora ejecuta: npm run dev" -ForegroundColor Green

