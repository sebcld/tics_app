# Quick Start Guide - Bluetooth Classic

## Flujo rápido para desarrolladores

### 1️⃣ Preparar el ESP32 (5 minutos)

```bash
# Abre Arduino IDE y compila/sube:
# esp32/backsafe_fsr/backsafe_fsr.ino

# Verifica en Serial Monitor (115200 baud):
# ✓ Bluetooth Classic initialized
# ✓ Device name: Backsafe_ESP32
```

### 2️⃣ Emparejar en Android (2 minutos)

1. Ajustes → Bluetooth → Encender
2. Buscar → "Backsafe_ESP32"
3. PIN: `1234`
4. Emparejar

### 3️⃣ Instalar dependencias (3 minutos)

```bash
cd tics_app
npm install
# o
yarn install
```

### 4️⃣ Compilar para Android (10 minutos)

```bash
npm run prebuild:android
```

### 5️⃣ Hacer build de desarrollo

```bash
eas build -p android --profile development
```

Descarga e instala el APK en tu dispositivo.

### 6️⃣ Ejecutar en desarrollo

```bash
npm run android:dev
```

O en una terminal separada:
```bash
npx expo start --dev-client
```

## Prueba inmediata

La app debe:
1. ✅ Detectar automáticamente "Backsafe_ESP32"
2. ✅ Conectar en ~5 segundos
3. ✅ Mostrar "Conectado a Backsafe_ESP32"
4. ✅ Recibir notificaciones cada 3 segundos
5. ✅ Cambiar estado entre "ok" y "alert"

## Comandos en Serial Monitor del ESP32

### Ver conexión:
```
*** CLIENT CONNECTED ***

Data from app: START
```

### Enviar notificación:
```
╔════════════════════════════════════════╗
║  SCENARIO 1: Good Posture - Centered
╚════════════════════════════════════════╝
Status: ok
Alert: false
ZoneStatus: neutral
Payload size: 287 bytes
Sending...
✓ Notification sent via Bluetooth Classic
```

## Debug en React Native

### Ver logs en consola:
```bash
# Terminal con expo start
npx expo start --dev-client
```

### Buscar en logs:
```
Bluetooth Classic: scanning for devices...
Bluetooth Classic: found device Backsafe_ESP32
Bluetooth Classic: connecting to [ID]
Bluetooth Classic: connected successfully
Bluetooth Classic: starting notification monitor
```

## Cambios clave vs BLE

| Aspecto | BLE (Antiguo) | Bluetooth Classic (Nuevo) |
|---|---|---|
| **Import** | `react-native-ble-plx` | `react-native-bluetooth-serial` |
| **Archivo servicio** | `src/services/ble.ts` | `src/services/bluetoothClassic.ts` |
| **Descubrimiento** | Dinámico | Emparejamiento previo |
| **MTU** | 20 bytes | 4KB |
| **Fragmentación** | Manual | Transparente |

## Solución rápida de problemas

### "No se conecta"
```bash
# 1. Verifica emparejamiento en Bluetooth del teléfono
# 2. Serial Monitor del ESP32 debe decir: *** CLIENT CONNECTED ***
# 3. Reinicia ESP32 (botón RST)
# 4. Recarga la app
```

### "Error de permisos"
```bash
# La app solicita permisos automáticamente
# Si no aparece el diálogo:
# - Verifica que esté en Android 12+
# - Reinstala la app
```

### "Datos no llegan"
```bash
# En Serial Monitor del ESP32, deberías ver:
# ✓ Notification sent via Bluetooth Classic
# Si no aparece, verifica que isRunning = true
```

## Archivos clave

```
tics_app/
├── esp32/
│   └── backsafe_fsr/
│       └── backsafe_fsr.ino          ← Firmware ESP32
├── src/
│   ├── services/
│   │   └── bluetoothClassic.ts       ← Cliente Bluetooth (NUEVO)
│   ├── context/
│   │   └── BacksafeContext.tsx       ← Contexto (actualizado)
├── package.json                       ← Dependencias
├── BLUETOOTH_CLASSIC_MIGRATION.md    ← Docs técnicas (NUEVO)
├── ESP32_SETUP_GUIDE.md              ← Setup ESP32 (NUEVO)
└── BLE_VS_BLUETOOTH_CLASSIC.md       ← Comparativa (NUEVO)
```

## Próximas mejoras (opcional)

- [ ] UI para re-emparejamiento
- [ ] Lista de dispositivos disponibles
- [ ] Reconexión automática mejorada
- [ ] Persistencia de dispositivo seleccionado
- [ ] Información de señal (RSSI)

## Documentación adicional

- 📖 [BLUETOOTH_CLASSIC_MIGRATION.md](./BLUETOOTH_CLASSIC_MIGRATION.md) - Detalles completos
- 🔧 [ESP32_SETUP_GUIDE.md](./ESP32_SETUP_GUIDE.md) - Configuración del firmware
- 📊 [BLE_VS_BLUETOOTH_CLASSIC.md](./BLE_VS_BLUETOOTH_CLASSIC.md) - Análisis técnico
- 📝 [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md) - Resumen de cambios

---

**¿Preguntas?** Consulta la documentación o revisa los logs en:
- ESP32: Serial Monitor (115200 baud)
- React Native: Console del Expo Dev Client
