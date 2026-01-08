# Script para detener solo el servidor backend (puerto 5000)
Write-Host "Deteniendo servidor Backend (puerto 5000)..." -ForegroundColor Yellow

$processes = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | 
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
    Write-Host "Backend detenido" -ForegroundColor Green
} else {
    Write-Host "No hay procesos en el puerto 5000" -ForegroundColor Gray
}

