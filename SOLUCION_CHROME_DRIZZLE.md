# Solución: Chrome Bloquea Drizzle Studio

## Problema
Chrome está bloqueando el acceso a `localhost:4983` por defecto (protección de seguridad).

## Solución Rápida ⚡

### Paso 1: Habilitar Acceso a Red Local en Chrome

1. **En la barra de direcciones** (donde dice `local.drizzle.studio`), haz clic en el **ícono de información (ⓘ)** a la izquierda de la URL.

2. **Se abrirá un menú** con opciones de permisos del sitio.

3. **Busca la opción "Local network access"** o "Acceso a red local".

4. **Cámbiala de "Bloquear" a "Permitir"** o simplemente **habilítala**.

5. **Recarga la página** (F5 o Ctrl+R).

---

## Alternativa: Usar la URL Directa

Si la solución anterior no funciona, intenta acceder directamente a:

```
http://localhost:4983
```

En lugar de `local.drizzle.studio`.

---

## Verificar que Drizzle Studio está Corriendo

Antes de hacer lo anterior, asegúrate de que Drizzle Studio está corriendo:

1. **Verifica en la terminal** donde ejecutaste `npm run db:studio`
2. **Deberías ver** algo como: `✓ Drizzle Studio running on http://localhost:4983`

Si no ves ese mensaje, hay un error. Ejecuta:

```powershell
cd RodMarInventory
npm run db:studio
```

Y revisa si hay errores en la consola.

---

## Si Nada Funciona

Usa directamente la **consola SQL de Railway** que es más directa:

1. Ve a Railway → Tu proyecto → PostgreSQL
2. Pestaña "Data" o "Query"  
3. Ejecuta los scripts SQL de `SCRIPTS_SQL_DRIZZLE.md`



