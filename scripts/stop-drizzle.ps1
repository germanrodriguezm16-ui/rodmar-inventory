# Script para detener solo Drizzle Studio (puerto 4983)
Write-Host "Deteniendo Drizzle Studio (puerto 4983)..." -ForegroundColor Yellow

$processes = Get-NetTCPConnection -LocalPort 4983 -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($processId in $processes) {
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  Deteniendo proceso PID: $processId ($($proc.ProcessName))" -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 2
    Write-Host "Drizzle Studio detenido" -ForegroundColor Green
} else {
    Write-Host "No hay procesos en el puerto 4983" -ForegroundColor Gray
}

