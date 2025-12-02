# Script para iniciar el servidor RodMar Inventory
# Ejecuta este script desde PowerShell: .\start-server.ps1

Write-Host "Iniciando servidor RodMar Inventory..." -ForegroundColor Green
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "Error: No se encontro package.json" -ForegroundColor Red
    Write-Host "   Asegurate de estar en el directorio RodMarInventory" -ForegroundColor Yellow
    exit 1
}

# Verificar que existe .env
if (-not (Test-Path ".env")) {
    Write-Host "Advertencia: No se encontro archivo .env" -ForegroundColor Yellow
    Write-Host "   Algunas funcionalidades pueden no funcionar" -ForegroundColor Yellow
    Write-Host ""
}

# Mostrar informacion de la base de datos
if (Test-Path ".env") {
    $dbUrl = Get-Content .env | Select-String "DATABASE_URL"
    if ($dbUrl) {
        Write-Host "DATABASE_URL configurada" -ForegroundColor Green
        $url = ($dbUrl -replace "DATABASE_URL=", "").Trim()
        if ($url -match "supabase") {
            Write-Host "   Conectando a Supabase..." -ForegroundColor Cyan
        } else {
            Write-Host "   URL: $url" -ForegroundColor Cyan
        }
    } else {
        Write-Host "DATABASE_URL no encontrada en .env" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Iniciar el servidor
Write-Host "Iniciando servidor de desarrollo..." -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host ""

npm run dev
