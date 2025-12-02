# ⚡ COMPILACIÓN LOCAL - COMANDOS RÁPIDOS

## 🎯 OPCIÓN 1: Android Studio (RECOMENDADO para principiantes)

```bash
# 1. Terminal
cd c:\Users\Akusk\Desktop\tics\tics_app

# 2. Genera carpeta android/ (si no existe)
npx expo prebuild --platform android

# 3. Abre en Android Studio
# File → Open → selecciona carpeta "android/"
# O: explorer c:\Users\Akusk\Desktop\tics\tics_app\android

# 4. Espera a que sincronice Gradle (2-5 min)

# 5. Selecciona dispositivo (arriba a la derecha)

# 6. Presiona botón Run ▶️ (Shift + F10)

# 7. ¡Listo! La app se compilará y ejecutará
```

---

## 🎯 OPCIÓN 2: Gradle desde terminal (RÁPIDO sin GUI)

```bash
# 1. Terminal
cd c:\Users\Akusk\Desktop\tics\tics_app\android

# 2. Compilar APK debug (rápido, para desarrollo)
.\gradlew.bat assembleDebug

# 3. Instalar en dispositivo/emulador conectado
adb install -r app\build\outputs\apk\debug\app-debug.apk

# 4. Iniciar app
adb shell am start -n com.tics_app/.MainActivity

# 5. Ver logs
adb logcat
```

---

## 🎯 OPCIÓN 3: Expo Dev Client (SIN APK)

```bash
# 1. Terminal en carpeta del proyecto
cd c:\Users\Akusk\Desktop\tics\tics_app

# 2. Compilar dev client (una sola vez)
npm run prebuild:android

# 3. Abrir en Android Studio y Run (como Opción 1)
# File → Open → android/
# Selecciona dispositivo y presiona Run ▶️

# 4. Luego, en otra terminal para desarrollo:
npx expo start --dev-client

# 5. La app en el dispositivo recargará con tus cambios
```

---

## 📱 VERIFICAR DISPOSITIVO CONECTADO

```bash
# Ver dispositivos conectados
adb devices

# Si no aparece:
adb kill-server
adb start-server
adb devices
```

**Output esperado**:
```
List of attached devices
emulator-5554          device
or
AFGT5R2N8L5           device
```

---

## 📊 ARCHIVOS GENERADOS

Después de compilar, los APKs estarán en:

```
Debug (para testing):
c:\Users\Akusk\Desktop\tics\tics_app\android\app\build\outputs\apk\debug\app-debug.apk

Release (para producción):
c:\Users\Akusk\Desktop\tics\tics_app\android\app\build\outputs\apk\release\app-release.apk
```

---

## ⏱️ TIEMPO APROXIMADO

| Tarea | Tiempo |
|-------|--------|
| Setup inicial | 10-15 min |
| Primera compilación | 5-10 min |
| Compilaciones siguientes | 1-3 min |
| Con cambios de código | 30 seg - 1 min |

---

## 🚨 PROBLEMAS COMUNES

### "gradle: command not found"
**Solución**: Usa `.\gradlew.bat` en lugar de `gradle`

### "Gradle sync failed"
```bash
cd c:\Users\Akusk\Desktop\tics\tics_app\android
.\gradlew.bat clean
```

### "Dispositivo desconectado"
```bash
# Reinicia adb
adb kill-server
adb start-server
```

### "Puerto 8081 en uso"
```bash
npx expo start --dev-client --port 8082
```

---

## ✅ CHECKLIST

- [ ] Android SDK instalado
- [ ] JDK 11+ instalado
- [ ] `npx expo prebuild --platform android` ejecutado
- [ ] Dispositivo/emulador conectado
- [ ] Android Studio abierto
- [ ] Presionaste Run ▶️
- [ ] App se está compilando
- [ ] ¡Esperando a ver funcionar! 🎉

---

## 📞 SI ALGO FALLA

1. Ver logs: `adb logcat`
2. Limpiar cache: `.\gradlew.bat clean`
3. Reiniciar Android Studio
4. Consultar: [COMPILE_LOCALLY.md](./COMPILE_LOCALLY.md) (guía completa)

---

**¡Mucho más rápido que EAS! 🚀**
