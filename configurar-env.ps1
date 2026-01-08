# Script para configurar .env para desarrollo local
# Ejecuta este script para crear el archivo .env

Write-Host "🔧 Configuración de variables de entorno para Drizzle Studio" -ForegroundColor Cyan
Write-Host ""

# Verificar si ya existe .env
if (Test-Path ".env") {
    Write-Host "⚠️  Ya existe un archivo .env" -ForegroundColor Yellow
    $sobrescribir = Read-Host "¿Deseas sobrescribirlo? (s/n)"
    if ($sobrescribir -ne "s" -and $sobrescribir -ne "S") {
        Write-Host "❌ Cancelado" -ForegroundColor Red
        exit
    }
}

Write-Host "Ingresa tu DATABASE_URL de Railway:" -ForegroundColor Yellow
Write-Host "(Puedes obtenerla de: Railway → Tu Proyecto → PostgreSQL → Variables → DATABASE_URL)" -ForegroundColor Gray
Write-Host ""

$databaseUrl = Read-Host "DATABASE_URL"

if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    Write-Host "❌ DATABASE_URL no puede estar vacío" -ForegroundColor Red
    exit 1
}

# Crear archivo .env
$envContent = @"
# Variables de entorno para desarrollo local
# Generado automáticamente - NO SUBIR A GIT

DATABASE_URL=$databaseUrl
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "✅ Archivo .env creado exitosamente" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora puedes ejecutar:" -ForegroundColor Cyan
Write-Host "  npm run db:studio" -ForegroundColor White
Write-Host ""



