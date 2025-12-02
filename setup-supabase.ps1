# Script interactivo para configurar Supabase
# Ejecuta: .\setup-supabase.ps1

Write-Host ""
Write-Host "=== Configuracion de Supabase para RodMar Inventory ===" -ForegroundColor Cyan
Write-Host ""

# Verificar si ya existe .env
if (Test-Path ".env") {
    Write-Host "[ADVERTENCIA] Ya existe un archivo .env" -ForegroundColor Yellow
    $overwrite = Read-Host "¿Deseas sobrescribirlo? (s/n)"
    if ($overwrite -ne "s") {
        Write-Host "[ERROR] Operacion cancelada." -ForegroundColor Red
        exit
    }
}

Write-Host "Necesito la siguiente informacion:" -ForegroundColor Green
Write-Host ""

# Solicitar DATABASE_URL
Write-Host "1. DATABASE_URL de Supabase" -ForegroundColor Yellow
Write-Host "   Para obtenerla:" -ForegroundColor Gray
Write-Host "   - Ve a https://app.supabase.com" -ForegroundColor Gray
Write-Host "   - Settings → Database → Connection string → URI" -ForegroundColor Gray
Write-Host "   - Copia la URL completa" -ForegroundColor Gray
Write-Host ""
$databaseUrl = Read-Host "   Pega la DATABASE_URL aquí (reemplaza [YOUR-PASSWORD] con tu contraseña)"

if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    Write-Host "[ERROR] DATABASE_URL no puede estar vacia" -ForegroundColor Red
    exit 1
}

# Verificar que incluya la contraseña
if ($databaseUrl -match '\[YOUR-PASSWORD\]' -or $databaseUrl -match 'YOUR-PASSWORD') {
    Write-Host ""
    Write-Host "[ADVERTENCIA] Parece que no reemplazaste [YOUR-PASSWORD]" -ForegroundColor Yellow
    Write-Host "   La URL debe incluir tu contraseña real" -ForegroundColor Yellow
    $continue = Read-Host "   ¿Deseas continuar de todos modos? (s/n)"
    if ($continue -ne "s") {
        Write-Host "[ERROR] Operacion cancelada." -ForegroundColor Red
        exit
    }
}

# Generar SESSION_SECRET
Write-Host ""
Write-Host "2. Generando SESSION_SECRET..." -ForegroundColor Yellow
$sessionSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
Write-Host "   [OK] SESSION_SECRET generado" -ForegroundColor Green

# Configuración por defecto
$port = "5000"
$nodeEnv = "development"
$usePgSessions = "false"
$corsOrigin = "http://localhost:5173"

Write-Host ""
Write-Host "3. Configuracion del servidor (puedes usar los valores por defecto)" -ForegroundColor Yellow
$portInput = Read-Host "   Puerto del servidor [$port]"
if (-not [string]::IsNullOrWhiteSpace($portInput)) {
    $port = $portInput
}

Write-Host ""
Write-Host "Creando archivo .env..." -ForegroundColor Cyan

# Crear contenido del .env
$envContent = @"
# Base de Datos Supabase
DATABASE_URL=$databaseUrl

# Servidor
PORT=$port
NODE_ENV=$nodeEnv

# Sesiones
SESSION_SECRET=$sessionSecret
USE_PG_SESSIONS=$usePgSessions

# CORS
CORS_ORIGIN=$corsOrigin
"@

# Escribir archivo
$envContent | Out-File -FilePath ".env" -Encoding utf8

Write-Host "[OK] Archivo .env creado exitosamente" -ForegroundColor Green
Write-Host ""

# Verificar conexión
Write-Host "Verificando conexion..." -ForegroundColor Cyan
Write-Host ""

# Extraer hostname para verificar DNS
if ($databaseUrl -match '@([^:]+)') {
    $hostname = $matches[1]
    Write-Host "   Verificando DNS para: $hostname" -ForegroundColor Gray
    
    try {
        $dns = Resolve-DnsName $hostname -ErrorAction Stop
        Write-Host "   [OK] DNS resuelto correctamente" -ForegroundColor Green
        Write-Host "      IP: $($dns[0].IPAddress)" -ForegroundColor Gray
    } catch {
        Write-Host "   [ADVERTENCIA] No se pudo resolver DNS (puede ser normal si el proyecto esta inactivo)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "[OK] Configuracion completada!" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Cyan
Write-Host "   1. Verifica la conexion: .\check-connection.ps1" -ForegroundColor White
Write-Host "   2. Sincroniza el esquema: npm run db:push" -ForegroundColor White
Write-Host "   3. Inicia el servidor: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Para mas informacion, consulta: CONFIGURAR_SUPABASE.md" -ForegroundColor Cyan
Write-Host ""

