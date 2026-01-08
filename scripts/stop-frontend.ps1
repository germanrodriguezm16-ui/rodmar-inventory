# Script para detener solo el servidor frontend (puerto 5173)
Write-Host "Deteniendo servidor Frontend (puerto 5173)..." -ForegroundColor Yellow

$processes = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | 
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
    Write-Host "Frontend detenido" -ForegroundColor Green
} else {
    Write-Host "No hay procesos en el puerto 5173" -ForegroundColor Gray
}

