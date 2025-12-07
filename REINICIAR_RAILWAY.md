# 🔄 Reiniciar Servicio en Railway

## Pasos para Reiniciar

1. **Ve a Railway:**
   - Abre [railway.app](https://railway.app)
   - Inicia sesión
   - Selecciona tu proyecto

2. **Encuentra tu servicio backend:**
   - Busca el servicio que tiene el código del backend (no la base de datos)
   - Debería tener un nombre como "rodmar-inventory" o similar

3. **Reinicia el servicio:**
   - Haz clic en el servicio
   - Ve a la pestaña **"Settings"** o **"Deployments"**
   - Busca el botón **"Restart"** o **"Redeploy"**
   - Haz clic en él

   **O alternativamente:**
   - Ve a **"Deployments"**
   - Haz clic en el deployment más reciente
   - Haz clic en **"..."** (tres puntos) → **"Redeploy"**

4. **Espera a que termine:**
   - Verás el estado cambiando a "Building" → "Deploying" → "Active"
   - Esto puede tomar 1-3 minutos

5. **Verifica:**
   - Abre `https://rodmar-inventory.vercel.app`
   - Debería cargar sin errores 500
   - Las transacciones deberían aparecer

---

## Si el Reinicio No Funciona

Si después de reiniciar sigue dando error 500:

1. **Revisa los logs en Railway:**
   - Ve a tu servicio → **"Logs"**
   - Busca errores recientes
   - Copia el mensaje de error completo

2. **Verifica la conexión a la base de datos:**
   - En Railway, ve a **"Variables"**
   - Verifica que `DATABASE_URL` esté correcta
   - Debe apuntar a tu base de datos de Supabase

3. **Prueba el endpoint directamente:**
   - Abre: `https://rodmar-inventory-production.up.railway.app/api/status`
   - Debería responder con información del servidor
   - Si no responde, el servicio no está funcionando

---

## Nota sobre la Cuota de Supabase

Veo que hay un banner que dice "Organization plan has exceeded its quota" con período de gracia hasta el 8 de diciembre de 2025.

Esto **NO debería** causar el error 500, pero si el período de gracia expira, podría afectar el funcionamiento.

Para verificar:
- Ve a Supabase → **Settings** → **Usage**
- Revisa qué recursos están excedidos
- Considera actualizar el plan si es necesario

