# Script para actualizar DATABASE_URL con connection pooling
Write-Host "Actualizando DATABASE_URL a formato connection pooling..." -ForegroundColor Cyan
Write-Host ""

$password = "5TQ1cwW3ZqBK8CXX"
$projectRef = "ftzkvgawbigqfndualpu"
$region = "us-east-2"  # East US (Ohio)

# Formato de connection pooling (más confiable)
$poolerUrl = "postgresql://postgres.$projectRef`:$password@aws-0-$region.pooler.supabase.com:6543/postgres"

Write-Host "Nueva URL (pooling):" -ForegroundColor Yellow
Write-Host $poolerUrl
Write-Host ""

# Leer .env actual
if (Test-Path ".env") {
    $envContent = Get-Content .env
    $newContent = @()
    
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=") {
            $newContent += "DATABASE_URL=$poolerUrl"
        } else {
            $newContent += $line
        }
    }
    
    # Si no había DATABASE_URL, agregarla
    if (-not ($envContent | Select-String "^DATABASE_URL=")) {
        $newContent = @("DATABASE_URL=$poolerUrl") + $newContent
    }
    
    $newContent | Out-File -FilePath .env -Encoding utf8
    Write-Host "✅ .env actualizado con connection pooling" -ForegroundColor Green
} else {
    Write-Host "❌ Archivo .env no existe" -ForegroundColor Red
}

Write-Host ""
Write-Host "Ahora reinicia el servidor: npm run dev" -ForegroundColor Yellow


