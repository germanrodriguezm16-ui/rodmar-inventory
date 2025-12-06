# 📱 Guía para Crear APK Android - RodMar Inventory

Esta guía te ayudará a crear un APK Android que apunta a tu aplicación web RodMar.

## 🎯 Opciones Disponibles

### Opción 1: Capacitor (Recomendado) ⭐
- ✅ Más control y flexibilidad
- ✅ Mejor integración con Android
- ✅ Permite agregar funcionalidades nativas en el futuro
- ✅ Genera APK firmado listo para instalar

### Opción 2: PWABuilder (Rápido)
- ✅ Muy rápido (solo necesitas la URL)
- ✅ Genera APK directamente desde el navegador
- ⚠️ Menos control sobre la configuración

---

## 🚀 Opción 1: Usando Capacitor (Recomendado)

### Paso 1: Instalar Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Paso 2: Inicializar Capacitor

```bash
npx cap init
```

Cuando te pregunte:
- **App name**: `RodMar`
- **App ID**: `com.rodmar.app` (o el que prefieras)
- **Web dir**: `dist/public` (o donde esté tu build)

### Paso 3: Agregar Plataforma Android

```bash
npx cap add android
```

### Paso 4: Configurar Capacitor

Edita `capacitor.config.ts` (se creará automáticamente):

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rodmar.app',
  appName: 'RodMar',
  webDir: 'dist/public',
  server: {
    // ⚠️ IMPORTANTE: Reemplaza con tu URL de producción
    url: 'https://tu-app.railway.app', // o tu URL de Vercel/Railway/etc
    cleartext: true // Solo si usas HTTP (no recomendado en producción)
  },
  android: {
    allowMixedContent: true,
    buildOptions: {
      keystorePath: undefined, // Configurar para firmar APK
      keystoreAlias: undefined,
    }
  }
};

export default config;
```

### Paso 5: Construir la Aplicación Web

```bash
npm run build
```

### Paso 6: Sincronizar con Android

```bash
npx cap sync android
```

### Paso 7: Abrir en Android Studio

```bash
npx cap open android
```

### Paso 8: Generar APK en Android Studio

1. En Android Studio, ve a **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. Espera a que compile
3. El APK estará en: `android/app/build/outputs/apk/debug/app-debug.apk`

### Paso 9: (Opcional) Firmar APK para Producción

Para instalar en dispositivos sin "Fuentes desconocidas", necesitas firmar el APK:

```bash
# Generar keystore (solo una vez)
keytool -genkey -v -keystore rodmar-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias rodmar

# Firmar APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore rodmar-release-key.jks app-debug.apk rodmar

# Verificar firma
jarsigner -verify -verbose -certs app-debug.apk
```

---

## ⚡ Opción 2: Usando PWABuilder (Rápido)

### Paso 1: Ir a PWABuilder

1. Ve a **https://www.pwabuilder.com**
2. Ingresa la URL de tu aplicación web desplegada
3. Haz clic en "Start"

### Paso 2: Generar APK

1. PWABuilder analizará tu PWA
2. Haz clic en "Build My PWA"
3. Selecciona "Android"
4. Descarga el APK generado

### Paso 3: Instalar APK

1. Transfiere el APK a tu dispositivo Android
2. Habilita "Fuentes desconocidas" en configuración
3. Instala el APK

---

## 🔧 Configuración Avanzada (Capacitor)

### Configurar Permisos Android

Edita `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest>
  <!-- Permisos necesarios -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  
  <!-- Para cámara (si usas upload de imágenes) -->
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-feature android:name="android.hardware.camera" android:required="false" />
  
  <application
    android:usesCleartextTraffic="true"
    ...>
    <!-- Tu configuración -->
  </application>
</manifest>
```

### Configurar WebView

Edita `android/app/src/main/java/com/rodmar/app/MainActivity.java`:

```java
package com.rodmar.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Configurar WebView
        this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);
        this.bridge.getWebView().getSettings().setDomStorageEnabled(true);
        this.bridge.getWebView().getSettings().setDatabaseEnabled(true);
    }
}
```

### Personalizar Icono y Splash Screen

1. Coloca tus iconos en `android/app/src/main/res/`:
   - `mipmap-mdpi/ic_launcher.png` (48x48)
   - `mipmap-hdpi/ic_launcher.png` (72x72)
   - `mipmap-xhdpi/ic_launcher.png` (96x96)
   - `mipmap-xxhdpi/ic_launcher.png` (144x144)
   - `mipmap-xxxhdpi/ic_launcher.png` (192x192)

2. O usa el plugin de Capacitor:
```bash
npm install @capacitor/assets
npx capacitor-assets generate
```

---

## 📝 Variables de Entorno

Crea un archivo `.env.capacitor` (opcional):

```env
CAPACITOR_APP_URL=https://tu-app.railway.app
CAPACITOR_APP_ID=com.rodmar.app
```

---

## 🐛 Solución de Problemas

### Error: "Cannot find module '@capacitor/core'"
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Error: "WebView not loading"
- Verifica que la URL en `capacitor.config.ts` sea correcta
- Asegúrate de que `allowMixedContent: true` esté configurado
- Verifica permisos de Internet en AndroidManifest.xml

### Error: "APK installation failed"
- Habilita "Fuentes desconocidas" en tu dispositivo
- Verifica que el APK esté firmado correctamente

### La app no carga la URL
- Verifica que la URL sea accesible desde Internet
- Verifica que no haya problemas de CORS
- Revisa los logs de Android Studio

---

## 📦 Estructura de Archivos

Después de configurar Capacitor, tendrás:

```
RodMarInventory/
├── android/              # Proyecto Android nativo
│   ├── app/
│   │   └── src/
│   │       └── main/
│   │           ├── AndroidManifest.xml
│   │           └── java/com/rodmar/app/
│   └── build.gradle
├── capacitor.config.ts   # Configuración de Capacitor
└── package.json
```

---

## 🚀 Comandos Útiles

```bash
# Sincronizar cambios
npx cap sync android

# Abrir en Android Studio
npx cap open android

# Copiar web assets
npx cap copy android

# Actualizar dependencias nativas
npx cap update android
```

---

## 📱 Próximos Pasos

1. **Configurar URL de producción** en `capacitor.config.ts`
2. **Instalar Capacitor** y dependencias
3. **Generar APK** siguiendo los pasos
4. **Probar en dispositivo** Android
5. **Firmar APK** para distribución

---

## 🔗 Recursos

- [Documentación Capacitor](https://capacitorjs.com/docs)
- [Guía Android Capacitor](https://capacitorjs.com/docs/android)
- [PWABuilder](https://www.pwabuilder.com)

---

**Nota**: Asegúrate de tener la URL de producción de tu aplicación web antes de comenzar.

