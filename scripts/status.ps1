# Script para verificar el estado de todos los servidores
Write-Host "`nEstado de los servidores:`n" -ForegroundColor Cyan

$backend = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
$frontend = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
$drizzle = Get-NetTCPConnection -LocalPort 4983 -ErrorAction SilentlyContinue

Write-Host "  Backend (puerto 5000):    $(if ($backend) { 'Corriendo' } else { 'Detenido' })"
Write-Host "  Frontend (puerto 5173):   $(if ($frontend) { 'Corriendo' } else { 'Detenido' })"
Write-Host "  Drizzle Studio (puerto 4983): $(if ($drizzle) { 'Corriendo' } else { 'Detenido' })"

Write-Host ""

