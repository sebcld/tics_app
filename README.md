# Guía: Ejecutar la App en Android

Esta guía explica cómo ejecutar la aplicación Backsafe TICS en un dispositivo o emulador Android usando Expo Dev Client.

## 📋 Prerrequisitos

1. **Node.js** instalado (v18 o superior)
2. **EAS CLI** instalado globalmente:
   ```bash
   npm install -g eas-cli
   ```
3. **Android Studio** instalado (para el emulador y herramientas ADB)
4. **Cuenta Expo** (gratuita): [expo.dev](https://expo.dev)

## 🔧 Configuración Inicial

### 1. Variables de Entorno

**NOTA: A partir de la versión Bluetooth Classic, las UUIDs BLE ya no son necesarias. La app se conecta automáticamente a dispositivos Backsafe emparejados.**

Crea un archivo `.env` en la raíz del proyecto basado en `.env.example` (si necesitas configuración personalizada):

```bash
cp .env.example .env
```

### Configuración heredada de BLE (ya no se usa):
- `EXPO_PUBLIC_BACKSAFE_NAME_PREFIX`: Prefijo del nombre del dispositivo (ej: "Backsafe")
- `EXPO_PUBLIC_BACKSAFE_SERVICE_UUID`: UUID del servicio BLE (deprecated)
- `EXPO_PUBLIC_BACKSAFE_CHAR_COMMAND_UUID`: UUID para enviar comandos (deprecated)
- `EXPO_PUBLIC_BACKSAFE_CHAR_NOTIFY_UUID`: UUID para recibir notificaciones (deprecated)

### 2. Iniciar Sesión en Expo

```bash
eas login
```

Verifica que estés conectado:
```bash
eas whoami
```

## 🚀 Opción A: Usar EAS Build (Recomendado para Dev Client)

### Paso 1: Construir el Dev Client

Construye el APK de desarrollo usando EAS:

```bash
eas build -p android --profile development
```

Este proceso puede tardar 10-20 minutos. Una vez completado:
- Recibirás un enlace para descargar el APK
- O puedes ver el estado con: `eas build:list`

### Paso 2: Instalar el APK

**En un Emulador Android:**

1. Inicia el emulador desde Android Studio
2. Verifica que esté conectado:
   ```bash
   adb devices
   ```
3. Instala el APK descargado:
   ```bash
   adb install -r path/al/archivo.apk
   ```

**En un Dispositivo Físico:**

1. Habilita "Opciones de desarrollador" y "Depuración USB" en tu Android
2. Conecta el dispositivo por USB
3. Verifica: `adb devices`
4. Instala: `adb install -r path/al/archivo.apk`

O simplemente descarga el APK desde el enlace que proporciona EAS y ábrelo en tu dispositivo.

### Paso 3: Iniciar el Bundler

Una vez instalado el Dev Client, inicia el servidor de desarrollo:

```bash
npx expo start --dev-client
```

### Paso 4: Abrir la App

- **En emulador**: Presiona `a` en la terminal para abrir automáticamente
- **En dispositivo físico**: Escanea el código QR que aparece en la terminal con la app Expo Go (no funciona) o con el Dev Client instalado

## 🔄 Opción B: Desarrollo Local (Sin EAS Build)

Si prefieres construir localmente sin usar EAS, puedes usar Android Studio directamente:

### 1. Generar el Proyecto Android Nativo

```bash
npx expo prebuild --platform android
```

Esto generará una carpeta `android/` con el proyecto nativo.

### 2. Abrir en Android Studio

1. Abre Android Studio
2. Selecciona "Open an Existing Project"
3. Navega a la carpeta `android/` dentro de tu proyecto
4. Espera a que Android Studio sincronice el proyecto (Gradle)

### 3. Configurar el Emulador

1. En Android Studio, ve a **Tools > Device Manager**
2. Crea un nuevo dispositivo virtual (AVD) si no tienes uno:
   - Recomendado: Pixel 5 o superior
   - API Level: 33 o superior
   - Habilitar Google Play Services
3. Inicia el emulador

### 4. Ejecutar la App

1. En Android Studio, selecciona tu emulador o dispositivo físico
2. Haz clic en el botón **Run** (▶️) o presiona `Shift+F10`
3. Espera a que la app se compile e instale

### 5. Iniciar el Bundler

En una terminal separada, inicia el servidor de desarrollo:

```bash
npx expo start --dev-client
```

La app debería conectarse automáticamente al bundler.

## 🧪 Probar Bluetooth Classic (Bluetooth Serial)

### ✅ Cambio importante: Se usa Bluetooth Classic en lugar de BLE

La app ahora usa **Bluetooth Classic (Serial Port Profile)** en lugar de BLE por razones técnicas:
- ✅ Sin límite de tamaño de paquete (BLE limitaba a 20 bytes)
- ✅ Comunicación más simple y directa
- ✅ Mayor confiabilidad para datos de sensores
- ⚠️ Requiere emparejamiento previo del ESP32

**Ver documentación completa**: [BLUETOOTH_CLASSIC_MIGRATION.md](./BLUETOOTH_CLASSIC_MIGRATION.md)

### Configuración en Dispositivo Físico

1. **Empareja el ESP32 desde Bluetooth del teléfono:**
   - Ajustes → Bluetooth → Buscar dispositivos
   - Busca "Backsafe_ESP32"
   - Solicita PIN: `1234`
   - Confirma emparejamiento

2. **Habilita Bluetooth** en el teléfono

3. **Abre la app y conecta:**
   - La app buscará automáticamente el dispositivo emparejado
   - Debe conectar en ~5 segundos
   - Recibirá notificaciones cada 3 segundos

### Verificar Permisos

La app requiere los siguientes permisos para Bluetooth Classic:
- `BLUETOOTH`
- `BLUETOOTH_ADMIN`
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION`

Estos ya están configurados en `app.json`.

## 📱 Scripts Útiles

El proyecto incluye los siguientes scripts en `package.json`:

```bash
# Iniciar el bundler con Dev Client
npm start

# Iniciar y abrir en Android (requiere emulador/dispositivo conectado)
npm run android

# Ver builds de EAS
eas build:list

# Ver perfil de desarrollo actual
eas build:configure
```

## 🐛 Solución de Problemas

### El emulador no aparece en `adb devices`

1. Verifica que el emulador esté corriendo
2. Reinicia el servidor ADB:
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```

### La app no se conecta al bundler

1. Verifica que el bundler esté corriendo: `npx expo start --dev-client`
2. Asegúrate de que el dispositivo y la computadora estén en la misma red WiFi
3. Verifica el firewall de Windows

### Error de permisos BLE

1. Verifica que los permisos estén en `app.json`
2. Reconstruye el Dev Client después de cambiar permisos
3. En el dispositivo, ve a Configuración > Apps > TICS App > Permisos y habilita Ubicación

### El build de EAS falla

1. Verifica que estés logueado: `eas whoami`
2. Revisa los logs: `eas build:list` y haz clic en el build fallido
3. Verifica que `eas.json` esté correctamente configurado

## 📚 Recursos Adicionales

- [Documentación de Expo Dev Client](https://docs.expo.dev/development/introduction/)
- [Documentación de EAS Build](https://docs.expo.dev/build/introduction/)
- [React Native Bluetooth Serial](https://github.com/rusel1989/react-native-bluetooth-serial)
- [Configuración de Android Studio](https://developer.android.com/studio)
- [ESP32 Bluetooth Classic](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/bluetooth.html)

### Documentación de migración
- [BLUETOOTH_CLASSIC_MIGRATION.md](./BLUETOOTH_CLASSIC_MIGRATION.md) - Detalles técnicos del cambio
- [BLE_VS_BLUETOOTH_CLASSIC.md](./BLE_VS_BLUETOOTH_CLASSIC.md) - Comparativa técnica
- [ESP32_SETUP_GUIDE.md](./ESP32_SETUP_GUIDE.md) - Guía de configuración del firmware

## 🎯 Flujo de Desarrollo Recomendado

1. **Primera vez**: Construye el Dev Client con `eas build -p android --profile development`
2. **Instala el APK** en tu dispositivo/emulador
3. **Desarrollo diario**:
   - Modifica el código
   - Guarda los cambios
   - El Dev Client recargará automáticamente (Fast Refresh)
4. **Cuando cambies dependencias nativas** (como permisos, plugins): Reconstruye el Dev Client

## 📝 Notas

- El Dev Client es más pesado que Expo Go pero permite usar módulos nativos como BLE
- Los cambios en JavaScript se recargan instantáneamente sin reconstruir
- Los cambios en `app.json` o dependencias nativas requieren reconstruir el Dev Client
- Para producción, usa: `eas build -p android --profile production`

