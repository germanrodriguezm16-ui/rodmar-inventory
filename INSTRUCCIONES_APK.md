# 📱 Instrucciones para Generar APK - RodMar Inventory

## ✅ Configuración Completada

Tu proyecto Android está configurado y listo para generar el APK. La aplicación apuntará a:
**https://rodmar-inventory.vercel.app**

---

## 🚀 Pasos para Generar el APK

### Opción 1: Usando Android Studio (Recomendado)

#### Paso 1: Abrir el Proyecto

```bash
npm run cap:open
```

Esto abrirá Android Studio automáticamente con tu proyecto.

#### Paso 2: Esperar a que Android Studio Indexe

- Android Studio descargará Gradle y dependencias automáticamente
- Esto puede tomar varios minutos la primera vez
- Espera hasta que veas "Gradle sync finished" en la parte inferior

#### Paso 3: Generar APK Debug

1. En Android Studio, ve al menú: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. Espera a que compile (puede tomar 2-5 minutos)
3. Cuando termine, verás una notificación: "APK(s) generated successfully"
4. Haz clic en "locate" en la notificación, o navega a:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

#### Paso 4: Instalar el APK

1. Transfiere el archivo `app-debug.apk` a tu dispositivo Android
2. En tu dispositivo, ve a **Configuración > Seguridad**
3. Habilita **"Fuentes desconocidas"** o **"Instalar apps desconocidas"**
4. Abre el archivo APK desde el explorador de archivos
5. Sigue las instrucciones para instalar

---

### Opción 2: Usando Línea de Comandos (Requiere Android SDK)

Si tienes Android SDK configurado en tu PATH:

```bash
cd android
./gradlew assembleDebug
```

El APK estará en: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔐 Generar APK Firmado para Producción (Opcional)

Para distribuir el APK públicamente, necesitas firmarlo:

### Paso 1: Generar Keystore

```bash
keytool -genkey -v -keystore rodmar-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias rodmar
```

Te pedirá:
- Contraseña del keystore (guárdala bien)
- Información de tu organización
- Contraseña del alias (puede ser la misma)

### Paso 2: Configurar en Android Studio

1. En Android Studio, ve a **Build > Generate Signed Bundle / APK**
2. Selecciona **APK**
3. Selecciona tu keystore (`rodmar-release-key.jks`)
4. Ingresa las contraseñas
5. Selecciona **release** como build variant
6. Marca **V1 (Jar Signature)** y **V2 (Full APK Signature)**
7. Haz clic en **Finish**

El APK firmado estará en: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🔄 Actualizar la App

Cada vez que hagas cambios en tu app web:

1. **Construir la app web:**
   ```bash
   npm run build:client
   ```

2. **Sincronizar con Android:**
   ```bash
   npm run cap:sync
   ```

3. **Abrir en Android Studio y generar nuevo APK:**
   ```bash
   npm run cap:open
   ```

O usa el comando todo-en-uno:
```bash
npm run android:build
```

---

## 🐛 Solución de Problemas

### Error: "SDK not found"
- Instala Android SDK desde Android Studio
- Ve a **Tools > SDK Manager**
- Instala **Android SDK Platform** y **Android SDK Build-Tools**

### Error: "Gradle sync failed"
- En Android Studio, ve a **File > Invalidate Caches / Restart**
- Selecciona **Invalidate and Restart**
- Espera a que Android Studio reinicie y reindexe

### La app no carga la URL
- Verifica que `capacitor.config.ts` tenga la URL correcta
- Verifica que tu app web esté accesible desde Internet
- Revisa los logs en Android Studio: **View > Tool Windows > Logcat**

### Error al instalar APK: "App not installed"
- Asegúrate de haber desinstalado versiones anteriores
- Verifica que el APK no esté corrupto (descárgalo nuevamente)
- Habilita "Fuentes desconocidas" en tu dispositivo

### La app se cierra al abrirla
- Revisa Logcat en Android Studio para ver el error
- Verifica que la URL en `capacitor.config.ts` sea accesible
- Asegúrate de que tu app web no tenga errores de CORS

---

## 📝 Notas Importantes

1. **URL de Producción**: La app está configurada para apuntar a `https://rodmar-inventory.vercel.app`
   - Para cambiarla, edita `capacitor.config.ts` y ejecuta `npm run cap:sync`

2. **Permisos**: La app tiene permisos para:
   - Internet (obligatorio)
   - Cámara (para subir imágenes)
   - Almacenamiento (para subir imágenes)

3. **Tamaño del APK**: El APK debug suele ser más grande (~20-30MB). El release es más pequeño.

4. **Actualizaciones**: Cuando actualices tu app web en Vercel, los usuarios necesitarán actualizar el APK manualmente (a menos que implementes un sistema de actualización OTA).

---

## 🎯 Próximos Pasos Sugeridos

1. **Probar el APK** en un dispositivo Android real
2. **Generar APK firmado** para distribución
3. **Subir a Google Play Store** (opcional, requiere cuenta de desarrollador)
4. **Implementar actualizaciones OTA** (opcional, usando Capacitor Live Updates)

---

## 📚 Recursos

- [Documentación Capacitor Android](https://capacitorjs.com/docs/android)
- [Guía de Firma de APK](https://developer.android.com/studio/publish/app-signing)
- [Android Studio Download](https://developer.android.com/studio)

---

**¡Tu proyecto está listo!** Solo necesitas abrir Android Studio y generar el APK.

