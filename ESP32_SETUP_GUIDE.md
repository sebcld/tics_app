# Guía de configuración del ESP32 para Bluetooth Classic

## Prerrequisitos

- Arduino IDE 1.8.0+
- ESP32 Board Support instalado en Arduino IDE
- Cable USB para programar el ESP32
- Biblioteca BluetoothSerial (incluida con ESP32 core)

## Instalación de ESP32 Board Support

1. En Arduino IDE: `File → Preferences`
2. En "Additional Boards Manager URLs" agrega:
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
3. `Tools → Board Manager`
4. Busca "ESP32" e instala "esp32" de Espressif Systems

## Configuración de Arduino IDE

### Board Selection
- **Board**: Generic ESP32
- **Port**: Selecciona el puerto COM del ESP32 (COMx en Windows)
- **Upload Speed**: 115200
- **CPU Frequency**: 80 MHz

### Verificación de Permisos (Linux/Mac)
```bash
# Si tienes problemas al subir código
sudo usermod -a -G dialout $USER
# Luego recarga la sesión o reinicia
```

## Compilación y Subida

1. Abre el archivo: `esp32/backsafe_fsr/backsafe_fsr.ino`
2. Comprueba que Arduino IDE detecte el ESP32 (debe aparecer el puerto COM)
3. Haz clic en `Subir` (flecha derecha) o presiona `Ctrl+U`
4. Espera a que termine la compilación y la subida

### Salida esperada
```
Connecting....
Chip is ESP32-D0WDQ5 (revision 0)
Features: WiFi, BT, Dual Core
MAC: xx:xx:xx:xx:xx:xx
Uploading...
```

## Prueba del Bluetooth Classic

### Terminal serie en Arduino IDE

1. Abre `Tools → Serial Monitor` (Ctrl+Shift+M)
2. Ajusta velocidad a **115200** baud
3. Deberías ver:

```
╔════════════════════════════════════════╗
║   BACKSAFE ESP32 - BLUETOOTH CLASSIC  ║
║   Simulated Posture Notifications     ║
╚════════════════════════════════════════╝

✓ Bluetooth Classic initialized
✓ Device name: Backsafe_ESP32
✓ Waiting for connection...

=== TEST SCENARIOS ===
0: Empty Chair
1: Good Posture - Centered
2: Leaning Forward
3: Leaning Back
4: Leaning Right
5: Leaning Left
6: Sitting on Edge
7: Good Posture - Slight Shift
======================

Connect from your Android app to start testing
```

## Emparejamiento del ESP32 en Android

### Pasos:

1. **Abre Ajustes del teléfono → Bluetooth**
2. **Habilita Bluetooth**
3. **Busca dispositivos**: Deberías ver "Backsafe_ESP32"
4. **Toca para emparejar**
   - Si pide código PIN: `1234`
   - Si pregunta por ubicación: Selecciona "Permitir"
5. **Confirma emparejamiento**

### Verificación en Serial Monitor

Cuando se conecte desde la app, deberías ver:

```
*** CLIENT CONNECTED ***

Data from app: START
CMD received: START
Monitoring started

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

## Posibles problemas

### "No se puede abrir puerto COM"
- **Causa**: Otro programa está usando el puerto (Arduino IDE, monitor serial, etc.)
- **Solución**: Cierra todas las instancias de Arduino IDE y reinicia

### "Error al subir: timeout"
- **Causa**: Velocidad de baudios incorrecta o puerto incorrecto
- **Solución**: 
  - Verifica que el Puerto sea el correcto (Tools → Port)
  - Reinicia el ESP32
  - Prueba con velocidad 115200

### ESP32 no aparece en emparejamiento Bluetooth
- **Causa**: Bluetooth clásico no está habilitado o el ESP32 no se reinició
- **Solución**:
  1. Presiona el botón RST del ESP32
  2. Espera 3 segundos
  3. Intenta emparejar nuevamente

### Bluetooth no está habilitado en el dispositivo
- **Solución**: Ve a Ajustes → Bluetooth → Enciende

## Configuración personalizada

### Cambiar nombre del dispositivo
En el archivo `backsafe_fsr.ino`, línea con:
```cpp
const char* BT_NAME = "Backsafe_ESP32";
```
Cámbialo a lo que desees (máximo 31 caracteres).

### Cambiar intervalo de notificaciones
En el `loop()`:
```cpp
if (millis() - lastNotify >= 3000) {  // 3000 ms = 3 segundos
```
Cámbialo al intervalo deseado en milisegundos.

### Agregar más escenarios de prueba
En el array `scenarios[]`, agrega una nueva estructura:
```cpp
{
  "Scenario Name",
  true,      // occupied
  false,     // alert
  "ok",      // status
  0.0f,      // angle
  "neutral", // zoneStatus
  800,       // seatSum
  200,       // backSum
  {80, 85, 90, 85, 80, 75, 70, 80, 85, 90, 50, 50, 50, 50} // values
}
```

## Diagrama de conexión

```
[ESP32]
  │
  ├─ GPIO 1 (TX) → Serial Monitor / USB
  ├─ GPIO 3 (RX) → Serial Monitor / USB
  ├─ GND → Tierra
  └─ 3V3/5V → Alimentación
  
  [Antena interna] → Bluetooth Classic
```

## Referencias

- [Documentación ESP32 BluetoothSerial](https://github.com/espressif/arduino-esp32/tree/master/libraries/BluetoothSerial)
- [Arduino IDE](https://www.arduino.cc/en/software)
- [Espressif ESP32 Official Docs](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/)

## Soporte

Si tienes problemas:
1. Verifica el Serial Monitor del ESP32
2. Consulta los mensajes de error
3. Prueba presionando el botón RST
4. Reinicia la app
