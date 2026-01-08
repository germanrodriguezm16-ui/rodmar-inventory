# Scripts de Reinicio de Servidores

Scripts para reiniciar cada servidor de forma independiente sin afectar a los otros.

## Uso

### Reiniciar Backend (puerto 5000)
```powershell
.\scripts\restart-backend.ps1
```

### Reiniciar Frontend (puerto 5173)
```powershell
.\scripts\restart-frontend.ps1
```

### Reiniciar Drizzle Studio (puerto 4983)
```powershell
.\scripts\restart-drizzle.ps1
```

### Detener Backend
```powershell
.\scripts\stop-backend.ps1
```

### Detener Frontend
```powershell
.\scripts\stop-frontend.ps1
```

### Detener Drizzle Studio
```powershell
.\scripts\stop-drizzle.ps1
```

### Ver estado de todos los servidores
```powershell
.\scripts\status.ps1
```

## Ejemplo de uso con Cursor AI

Cuando me pidas reiniciar un servidor específico, simplemente di:
- "reinicia el backend"
- "reinicia el frontend"
- "reinicia drizzle"
- "verifica el estado de los servidores"

Los scripts se ejecutarán automáticamente sin afectar a los otros servidores.



