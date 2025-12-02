# 🚀 Compilar localmente sin EAS - Guía paso a paso

## ¿Por qué compilar localmente?

✅ **Ventajas**:
- Más rápido (sin espera en cola)
- Control total del build
- Puedes debuggear mejor
- No necesitas internet para todo
- Compilaciones ilimitadas (offline)

⚠️ **Requisitos**:
- Android Studio instalado
- JDK 11+ instalado
- Android SDK
- ~5-10 GB de espacio disco

---

## 📋 PASO A PASO

### PASO 1: Verificar requisitos instalados

Abre PowerShell/Terminal y verifica:

```bash
# Verificar Node.js
node --version          # Debe ser v18+
npm --version           # Debe ser v9+

# Verificar Java/JDK
java -version           # Debe ser 11+
javac -version          # Debe ser 11+

# Verificar Android SDK
echo %ANDROID_HOME%     # Debe mostrar una ruta
```

Si falta algo, instálalo primero.

---

### PASO 2: Generar proyecto Android nativo

Ya lo hiciste, pero si necesitas regenerar:

```bash
cd c:\Users\Akusk\Desktop\tics\tics_app

# Limpiar primero (opcional pero recomendado)
npx expo prebuild --clean

# Generar carpeta android/
npx expo prebuild --platform android
```

**Output esperado**:
```
✔ Generated native project directory: android
✔ Successfully generated Android project in: c:\...\tics_app\android
```

---

### PASO 3: Abrir en Android Studio

```bash
# Opción A: Desde línea de comandos
cd c:\Users\Akusk\Desktop\tics\tics_app\android
start .   # En Windows, abre el explorador en esa carpeta

# Opción B: Manualmente
# 1. Abre Android Studio
# 2. File → Open
# 3. Navega a: c:\Users\Akusk\Desktop\tics\tics_app\android
# 4. Selecciona la carpeta android/
# 5. Espera a que sincronice (Gradle)
```

**Espera a que aparezca este mensaje**:
```
Gradle build finished successfully in X seconds
```

---

### PASO 4: Seleccionar dispositivo

#### Opción A: Emulador Android

```bash
# Abre Android Studio
# Tools → Device Manager
# Crea un nuevo AVD (si no tienes)
# O selecciona uno existente
# Presiona Play para iniciar

# Características recomendadas:
# - Pixel 5 o superior
# - Android API 33 o superior
# - 3GB+ RAM
# - Google Play Services habilitado
```

#### Opción B: Dispositivo físico

```bash
# 1. Conecta el teléfono por USB
# 2. Habilita "Opciones de desarrollador"
#    - Ajustes → Información del teléfono
#    - Toca "Número de compilación" 7 veces
# 3. Habilita "Depuración USB"
# 4. En Android Studio, debería aparecer

# Verifica desde terminal:
adb devices    # Debe mostrar tu dispositivo

# Si no aparece:
adb kill-server
adb start-server
adb devices    # Intenta de nuevo
```

---

### PASO 5: Compilar APK

#### Opción A: Desde Android Studio (MÁS FÁCIL)

```
1. En la barra arriba, selecciona tu dispositivo/emulador
2. Presiona el botón verde ▶️ (Run 'app')
3. O presiona Shift + F10
```

Android Studio compilará, instalará y ejecutará automáticamente.

#### Opción B: Desde línea de comandos

```bash
cd c:\Users\Akusk\Desktop\tics\tics_app\android

# Debug APK (más rápido, para desarrollo)
.\gradlew.bat assembleDebug

# Release APK (más lento, para producción)
# Nota: Necesita configurar signing
.\gradlew.bat assembleRelease

# Instalar en dispositivo conectado
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

---

### PASO 6: Ver logs en tiempo real

```bash
# Desde terminal, ver todos los logs
adb logcat

# O solo logs de tu app (Android 24+)
adb logcat --pid=$(adb shell pidof com.tics_app)

# En Android Studio:
# View → Tool Windows → Logcat
```

---

## 🎯 FLUJO COMPLETO (Resumen rápido)

```bash
# 1. Terminal en la carpeta del proyecto
cd c:\Users\Akusk\Desktop\tics\tics_app

# 2. Generar Android (si no existe)
npx expo prebuild --platform android

# 3. Abrir Android Studio
# Manual: File → Open → android/

# 4. Esperar a que Gradle sincronice (2-5 min)

# 5. Seleccionar dispositivo (arriba a la derecha)

# 6. Presionar Run (botón verde ▶️)

# 7. ¡Esperar compilación! (3-10 min la primera vez)

# 8. Aplicación se abrirá automáticamente
```

---

## 🚀 MÉTODO ALTERNATIVO: Gradle desde terminal (SIN Android Studio)

Si prefieres no abrir Android Studio:

```bash
cd c:\Users\Akusk\Desktop\tics\tics_app\android

# Compilar debug APK
.\gradlew.bat assembleDebug

# Si tienes dispositivo/emulador conectado:
adb install -r app\build\outputs\apk\debug\app-debug.apk

# Iniciar app
adb shell am start -n com.tics_app/.MainActivity

# Ver logs
adb logcat
```

**Archivos generados**:
```
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/release/app-release.apk (si compilas release)
```

---

## 🧪 TESTING EN VIVO

Una vez que la app está corriendo:

```bash
# Terminal 1: Ver logs
adb logcat

# Terminal 2: En la carpeta del proyecto
cd c:\Users\Akusk\Desktop\tics\tics_app
npx expo start --dev-client

# Terminal 3 (opcional): Si necesitas comandos adb
adb shell
```

**En el dispositivo/emulador**:
1. Debería aparecer la app
2. Presiona "Conectar"
3. Debería conectarse a Backsafe_ESP32
4. Ver notificaciones cada 3 segundos

---

## 🐛 TROUBLESHOOTING

### "build-tools not found"
```bash
# Abre Android Studio
# Tools → SDK Manager
# Busca "Android SDK Build-Tools"
# Instala versión 33.0.0 o superior
```

### "Gradle sync failed"
```bash
# Solución 1: Limpiar cache
cd android
.\gradlew.bat clean

# Solución 2: Invalidar cache en Android Studio
# File → Invalidate Caches → Invalidate and Restart
```

### "Dispositivo no aparece"
```bash
# ADB no encuentra el dispositivo
adb kill-server
adb start-server
adb devices

# Si aún no aparece:
# - Verifica "Depuración USB" habilitada
# - Reinicia el teléfono
# - Reinicia Android Studio
```

### "Puerto 8081 en uso"
```bash
# Si Expo dice que el puerto está ocupado:

# En Windows:
netstat -ano | findstr :8081
taskkill /PID <PID> /F

# O usa otro puerto:
npx expo start --dev-client --port 8082
```

### "Compilación muy lenta"
```bash
# Aumenta memoria Gradle
# Abre android/gradle.properties

# Modifica/agrega:
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=1024m
```

---

## 📊 COMPARATIVA: EAS vs Local

| Aspecto | EAS | Local |
|---------|-----|-------|
| **Velocidad** | Lenta (cola) | Rápida |
| **Offline** | No | Sí |
| **Compilaciones** | Limitadas (free tier) | Ilimitadas |
| **Setup** | Fácil | Más setup |
| **Control** | Limitado | Total |
| **Debugging** | Difícil | Fácil |
| **Para producción** | Recomendado | Funciona |

---

## ✅ RESUMEN

### Para compilar localmente:
1. ✅ Tienes Android SDK instalado
2. ✅ Tienes JDK 11+ instalado
3. ✅ Ya corriste `npx expo prebuild --platform android`
4. ✅ Abre `android/` en Android Studio
5. ✅ Presiona Run (botón verde)
6. ✅ ¡Compilación local en 3-10 minutos!

### Ventajas:
- ✅ **Más rápido** que EAS
- ✅ **Sin esperar en cola**
- ✅ **Control total**
- ✅ **Mejor para development**

### Próximo paso:
Abre Android Studio y presiona Run ▶️

---

## 📚 REFERENCIAS

- [Expo Prebuild Docs](https://docs.expo.dev/build-reference/apk/)
- [Android Studio Setup](https://developer.android.com/studio)
- [ADB Documentation](https://developer.android.com/tools/adb)
- [Gradle Build System](https://docs.gradle.org/current/userguide/build_lifecycle.html)

---

**¡Espero que la compilación local sea más rápida! 🚀**

Si tienes problemas, consulta la sección de troubleshooting o revisa los logs con `adb logcat`.
