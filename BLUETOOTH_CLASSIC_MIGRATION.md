# Cambio de BLE a Bluetooth Classic (SPP)

## Problema resuelto
BLE (Bluetooth Low Energy) tiene una limitación de **20 bytes por paquete** (MTU - Maximum Transmission Unit) en las notificaciones NOTIFY. Esto limitaba la cantidad de datos de sensores que podíamos enviar.

## Solución implementada
Se cambió el protocolo a **Bluetooth Classic (Serial Port Profile - SPP)** que:
- ✅ Permite enviar paquetes de **hasta 4KB por mensaje**
- ✅ No tiene limitación de tamaño de payload
- ✅ Es más estable para transferencias de datos grandes
- ✅ Es compatible con dispositivos Android antiguos

## Cambios realizados

### 1. ESP32 Firmware (`esp32/backsafe_fsr/backsafe_fsr.ino`)
**Cambios:**
- Reemplazó librería `NimBLEDevice.h` por `BluetoothSerial.h`
- Cambió de características GATT (BLE) a comunicación serial sobre Bluetooth
- El dispositivo ahora se registra como `Backsafe_ESP32` (nombre emparejado)
- Los comandos y notificaciones se envían como strings JSON terminados en `\n`
- No hay límite de tamaño para los payloads

**Cómo compilar:**
1. Asegúrate de tener habilitada la librería `BluetoothSerial` en Arduino IDE
2. Selecciona board "ESP32"
3. Compila y sube normalmente

**Pasos para usar:**
1. Empareja el ESP32 desde los ajustes de Bluetooth del teléfono
   - Busca "Backsafe_ESP32"
   - Contraseña por defecto: "1234"
2. Ejecuta la app - automáticamente encontrará y conectará

### 2. Servicios React Native (`src/services/`)

#### Nuevo archivo: `bluetoothClassic.ts`
Servicio que reemplaza `ble.ts` con las siguientes funciones:
- `scanAndConnect()`: Busca dispositivos emparejados con Backsafe/ESP32
- `connectToDevice()`: Conecta a un dispositivo específico
- `writeCommand()`: Envía comandos al ESP32
- `subscribeNotifications()`: Lee continuamente datos del buffer serial
- `disconnect()`: Desconecta de forma segura

**Características:**
- Lee datos cada 100ms desde el buffer serial
- Maneja múltiples líneas JSON por lectura
- Parseó automático del JSON con `parseNotifyPayload()`
- Manejo de permisos Android 12+ para Bluetooth

### 3. Contexto (`src/context/BacksafeContext.tsx`)
- Importa ahora de `bluetoothClassic` en lugar de `ble`
- Cambió tipo `Device` a `any` (compatible con ambas librerías)
- Mensajes actualizados para reflejar "Bluetooth Classic"

### 4. Dependencias (`package.json`)
- Agregado: `react-native-bluetooth-serial: ^2.2.9`
- Removido: `react-native-ble-plx: 2.0.3` (opcional, puede mantenerse)

## Flujo de comunicación

```
ESP32 (Bluetooth Classic - SPP)
   ↓
[Sistema operativo empareja dispositivo]
   ↓
React Native (bluetoothClassic.ts)
   ↓
Contexto (BacksafeContext.tsx)
   ↓
Componentes UI
```

## Protocolo de comunicación

### Envío de notificaciones (ESP32 → App)
```json
{
  "ts": 1234567890,
  "alert": false,
  "status": "ok",
  "angle": 0.0,
  "zoneAlert": false,
  "zoneStatus": "neutral",
  "occupied": true,
  "seatSum": 800,
  "backSum": 200,
  "values": [80, 85, 90, 85, 80, 75, 70, 80, 85, 90, 50, 50, 50, 50]
}
```

### Comandos (App → ESP32)
```
START      // Inicia monitoreo
STOP       // Detiene monitoreo
CALIBRATE  // Calibra sensores
CALIBRATE_POSTURE  // Calibra postura base
```

## Respuestas a comandos
```json
{"cmdAck": "CALIBRATE", "ok": true}
{"cmdAck": "START", "ok": true}
{"cmdAck": "STOP", "ok": true}
```

## Instalación de dependencias

```bash
cd tics_app
npm install
# o
yarn install

# Luego recompila para Android
npm run prebuild:android
```

## Prueba en modo desarrollo

```bash
npm run android:dev
```

## Ventajas vs desventajas

### ✅ Ventajas Bluetooth Classic
- Sin límite de tamaño de paquete
- Más compatible con hardware antiguo
- Más estable para datos grandes
- Menor latencia

### ⚠️ Consideraciones
- Requiere emparejamiento previo (no descubrimiento dinámico)
- Usa más energía que BLE
- No funciona en modo bajo consumo

## Debugging

### En el ESP32 (via Serial Monitor)
```
╔════════════════════════════════════════╗
║   BACKSAFE ESP32 - BLUETOOTH CLASSIC  ║
║   Simulated Posture Notifications     ║
╚════════════════════════════════════════╝

✓ Bluetooth Classic initialized
✓ Device name: Backsafe_ESP32
✓ Waiting for connection...

*** CLIENT CONNECTED ***
Data from app: START
Sending...
✓ Notification sent via Bluetooth Classic
```

### En React Native (via console.log)
```
Bluetooth Classic: scanning for devices...
Bluetooth Classic: found device Backsafe_ESP32
Bluetooth Classic: connecting to [ID]
Bluetooth Classic: connected successfully
Bluetooth Classic: starting notification monitor
Bluetooth Classic: received XX bytes
```

## Próximos pasos

1. Instalar la app compilada en teléfono físico
2. Emparejar ESP32 desde Bluetooth del teléfono
3. Ejecutar la app
4. Debe conectar automáticamente y recibir notificaciones

## Notas importantes

- **Puerto serial del ESP32**: Debe estar a 115200 baud
- **Nombre del dispositivo**: Exactamente `Backsafe_ESP32` (case sensitive en la búsqueda)
- **Permisos Android**: La app solicita automáticamente los permisos necesarios
- **Monitoreo continuos**: El buffer serial se lee cada 100ms para obtener latencia baja
