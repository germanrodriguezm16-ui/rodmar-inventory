# 📱 Guía Completa: Instalación de Android Studio y Java JDK

## 🎯 Objetivo
Instalar todo lo necesario para generar el APK de tu app RodMar usando Capacitor.

---

## 📋 Paso 1: Instalar Java JDK 17

### 1.1 Descargar Java JDK

1. **Abre tu navegador** y ve a: https://adoptium.net/
2. En la página principal, verás opciones para descargar:
   - **Version**: Selecciona **17 LTS** (Long Term Support)
   - **Operating System**: Selecciona **Windows**
   - **Architecture**: 
     - Si tienes Windows de 64 bits (la mayoría): **x64**
     - Si no estás seguro: **x64** (es lo más común)
3. **Haz clic en el botón de descarga** (dice algo como "Latest LTS Release")
4. Se descargará un archivo `.msi` (por ejemplo: `OpenJDK17U-jdk_x64_windows_hotspot_17.0.x_x64.msi`)

### 1.2 Instalar Java JDK

1. **Ejecuta el archivo `.msi`** que descargaste
2. Sigue el asistente de instalación:
   - Haz clic en **"Next"** en la pantalla de bienvenida
   - Acepta los términos y condiciones
   - **IMPORTANTE**: En la pantalla de "Custom Setup", asegúrate de que esté marcado:
     - ✅ **"Set JAVA_HOME variable"**
     - ✅ **"Add to PATH"**
   - Haz clic en **"Next"** y luego **"Install"**
   - Espera a que termine la instalación
   - Haz clic en **"Finish"**

### 1.3 Verificar Instalación

1. **Abre PowerShell** (o CMD) como administrador
2. Escribe:
   ```powershell
   java -version
   ```
3. Deberías ver algo como:
   ```
   openjdk version "17.0.x" ...
   ```
4. Si ves esto, ✅ **Java está instalado correctamente**

---

## 📋 Paso 2: Instalar Android Studio

### 2.1 Descargar Android Studio

1. **Abre tu navegador** y ve a: https://developer.android.com/studio
2. Haz clic en el botón grande **"Download Android Studio"**
3. Acepta los términos y condiciones
4. Se descargará un archivo `.exe` (por ejemplo: `android-studio-2023.x.x-windows.exe`)
   - El archivo es grande (~1 GB), puede tardar varios minutos

### 2.2 Instalar Android Studio

1. **Ejecuta el archivo `.exe`** que descargaste
2. Sigue el asistente de instalación:
   - Haz clic en **"Next"** en la pantalla de bienvenida
   - Selecciona los componentes (deja todo marcado por defecto):
     - ✅ Android Studio
     - ✅ Android SDK
     - ✅ Android SDK Platform
     - ✅ Android Virtual Device
   - Haz clic en **"Next"**
   - Selecciona la carpeta de instalación (puedes dejar la predeterminada)
   - Haz clic en **"Next"** y luego **"Install"**
   - Espera a que termine la instalación (puede tardar 10-15 minutos)
   - Haz clic en **"Finish"**

### 2.3 Configuración Inicial de Android Studio

1. **Abre Android Studio** (se abrirá automáticamente después de la instalación)
2. Si te pregunta sobre importar configuraciones, selecciona **"Do not import settings"**
3. **Bienvenida a Android Studio:**
   - Haz clic en **"Next"**
   - Selecciona **"Standard"** installation type
   - Haz clic en **"Next"**
   - Acepta los términos y condiciones
   - Haz clic en **"Next"**
   - Selecciona el tema (puedes elegir "Light" o "Darcula")
   - Haz clic en **"Next"** y luego **"Finish"**
4. **Android Studio comenzará a descargar componentes:**
   - Esto puede tardar **20-30 minutos** la primera vez
   - Verás una barra de progreso
   - **NO cierres Android Studio** durante este proceso
   - Espera hasta que veas "SDK Manager" o "Welcome to Android Studio"

### 2.4 Verificar Instalación

1. En Android Studio, ve a: **File > Settings** (o **Android Studio > Preferences** en Mac)
2. Ve a: **Appearance & Behavior > System Settings > Android SDK**
3. Deberías ver una lista de SDK Platforms instalados
4. Si ves esto, ✅ **Android Studio está instalado correctamente**

---

## 📋 Paso 3: Configurar Variables de Entorno (Si es necesario)

### 3.1 Verificar JAVA_HOME

1. **Abre PowerShell** como administrador
2. Escribe:
   ```powershell
   $env:JAVA_HOME
   ```
3. Si muestra una ruta (por ejemplo: `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`), ✅ está configurado
4. Si está vacío, necesitas configurarlo:
   ```powershell
   [System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot', 'Machine')
   ```
   (Reemplaza la ruta con la ubicación real de tu JDK)

### 3.2 Verificar ANDROID_HOME (Opcional)

Android Studio generalmente configura esto automáticamente, pero puedes verificar:

1. La ruta típica es: `C:\Users\TuUsuario\AppData\Local\Android\Sdk`
2. Si necesitas configurarlo manualmente:
   ```powershell
   [System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\TuUsuario\AppData\Local\Android\Sdk', 'Machine')
   ```

---

## ✅ Verificación Final

### Verificar que Todo Esté Instalado

Abre PowerShell y ejecuta:

```powershell
# Verificar Java
java -version

# Verificar Android SDK (si está en PATH)
adb version
```

Si ambos comandos funcionan, ✅ **Todo está listo**

---

## 🚀 Siguiente Paso: Generar el APK

Una vez que Android Studio esté instalado y configurado:

1. **Abre PowerShell** en la carpeta del proyecto:
   ```powershell
   cd C:\Users\germa\Downloads\RodMarInventory(1)\RodMarInventory
   ```

2. **Abre el proyecto en Android Studio:**
   ```powershell
   npm run cap:open
   ```

3. **Espera a que Android Studio indexe** (puede tardar varios minutos la primera vez)

4. **Genera el APK:**
   - En Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
   - Espera a que compile
   - El APK estará en: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🐛 Solución de Problemas

### Error: "JAVA_HOME is not set"
- Verifica que Java esté instalado: `java -version`
- Configura JAVA_HOME manualmente (ver Paso 3.1)

### Error: "SDK not found"
- Abre Android Studio
- Ve a: **File > Settings > Appearance & Behavior > System Settings > Android SDK**
- Haz clic en **"SDK Platforms"** y marca **Android 13.0 (Tiramisu)** o superior
- Haz clic en **"Apply"** y espera a que se instale

### Android Studio se congela al abrir
- Cierra Android Studio completamente
- Elimina la carpeta: `C:\Users\TuUsuario\.AndroidStudio*`
- Abre Android Studio nuevamente

### El APK no se genera
- Asegúrate de que el proyecto esté sincronizado: **File > Sync Project with Gradle Files**
- Espera a que termine la sincronización
- Intenta generar el APK nuevamente

---

## 📝 Notas Importantes

- **Primera vez**: La instalación y configuración inicial puede tardar **30-60 minutos**
- **Espacio en disco**: Necesitarás al menos **5-10 GB** de espacio libre
- **Internet**: Necesitas conexión estable para descargar componentes
- **Paciencia**: La primera vez que abres un proyecto en Android Studio puede tardar varios minutos

---

## 🎯 Resumen de Tiempos Estimados

- **Descargar Java JDK**: 2-5 minutos
- **Instalar Java JDK**: 2-3 minutos
- **Descargar Android Studio**: 10-20 minutos (depende de tu internet)
- **Instalar Android Studio**: 10-15 minutos
- **Configuración inicial**: 20-30 minutos (descarga de componentes)
- **Total**: ~45-75 minutos

---

**¡Una vez que termines la instalación, avísame y te guío para generar el APK!** 🚀

