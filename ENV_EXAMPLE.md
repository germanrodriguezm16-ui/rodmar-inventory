# Variables de entorno (ejemplo)

Este proyecto usa un archivo `.env` en la raíz para desarrollo local (no se sube a git).

## Ejemplo recomendado (rápido y silencioso)

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/rodmar_db
SESSION_SECRET=change-me
PORT=5000
NODE_ENV=development

# UI en el backend (dev). Usa "on" si quieres servir UI desde 5000.
DEV_SERVER_UI=off

# Sync masivo de permisos (en local conviene apagarlo)
PERMISSIONS_SYNC_ON_BOOT=off
PERMISSIONS_SYNC_VERBOSE=0

# Migraciones históricas (desactivadas por defecto)
# MIGRATIONS_ON_BOOT=off | background | blocking
MIGRATIONS_ON_BOOT=off
```

## Notas

- `PERMISSIONS_SYNC_ON_BOOT`:
  - `off`: no corre en el arranque.
  - `background`: corre en background (no bloquea).
  - `blocking`: bloquea el arranque (solo para “repair” puntual).
- `PERMISSIONS_SYNC_VERBOSE=1` activa logs detallados (muy verboso).

