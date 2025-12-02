# Script para inicializar Git y preparar el repositorio

Write-Host "🚀 Configurando Git para RodMar Inventory..." -ForegroundColor Cyan
Write-Host ""

# Verificar si ya existe un repositorio Git
if (Test-Path .git) {
    Write-Host "⚠️  Ya existe un repositorio Git en este directorio." -ForegroundColor Yellow
    $continue = Read-Host "¿Deseas continuar de todos modos? (s/n)"
    if ($continue -ne "s") {
        Write-Host "❌ Operación cancelada." -ForegroundColor Red
        exit
    }
}

# Inicializar Git
Write-Host "📦 Inicializando repositorio Git..." -ForegroundColor Green
git init

# Configurar branch principal
Write-Host "🌿 Configurando branch 'main'..." -ForegroundColor Green
git branch -M main

# Agregar todos los archivos
Write-Host "📝 Agregando archivos al staging..." -ForegroundColor Green
git add .

# Hacer commit inicial
Write-Host "💾 Creando commit inicial..." -ForegroundColor Green
git commit -m "Initial commit: RodMar Inventory System"

Write-Host ""
Write-Host "✅ ¡Repositorio Git inicializado correctamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Crea un repositorio en GitHub (https://github.com/new)" -ForegroundColor White
Write-Host "2. Ejecuta estos comandos (reemplaza TU_USUARIO y NOMBRE_REPO):" -ForegroundColor White
Write-Host ""
Write-Host "   git remote add origin https://github.com/TU_USUARIO/NOMBRE_REPO.git" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "📖 Para más detalles, consulta: GUIA_DESPLIEGUE_COMPLETA.md" -ForegroundColor Cyan

