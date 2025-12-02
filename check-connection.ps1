# Script para verificar la conexion a la base de datos
# Ejecuta este script desde PowerShell: .\check-connection.ps1

Write-Host "Verificando conexion a la base de datos..." -ForegroundColor Cyan
Write-Host ""

# Verificar .env
if (-not (Test-Path ".env")) {
    Write-Host "No se encontro archivo .env" -ForegroundColor Red
    exit 1
}

$dbUrl = Get-Content .env | Select-String "DATABASE_URL"
if (-not $dbUrl) {
    Write-Host "DATABASE_URL no encontrada en .env" -ForegroundColor Red
    exit 1
}

$url = ($dbUrl -replace "DATABASE_URL=", "").Trim()
Write-Host "URL de conexion encontrada:" -ForegroundColor Green
Write-Host "  $url" -ForegroundColor Gray
Write-Host ""

# Extraer hostname para verificar DNS
if ($url -match '@([^:]+)') {
    $hostname = $matches[1]
    Write-Host "Verificando resolucion DNS para: $hostname" -ForegroundColor Cyan
    
    try {
        $dns = Resolve-DnsName $hostname -ErrorAction Stop
        Write-Host "DNS resuelto correctamente" -ForegroundColor Green
        Write-Host "   IP: $($dns[0].IPAddress)" -ForegroundColor Gray
    } catch {
        Write-Host "Error resolviendo DNS: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Esto puede indicar que el proyecto de Supabase no esta activo" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Para probar la conexion completa, ejecuta:" -ForegroundColor Yellow
Write-Host "  npm run db:push" -ForegroundColor Cyan
