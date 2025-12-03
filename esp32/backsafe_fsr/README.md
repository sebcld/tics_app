# Backsafe ESP32 - FSR Array Sketch (Bluetooth Classic)

Arduino sketch para ESP32 que lee 14 FSR a través de un CD74HC4067 y envía telemetría de postura vía **Bluetooth Classic (SPP/Serial)** a la app móvil. El dispositivo se anuncia como `Backsafe_ESP32` y acepta PIN `1234` para emparejarse. La app también puede conectarse a un servidor WebSocket (mock) para recibir alertas; los datos de sensores siempre viajan por Bluetooth.

## Features principales

- **14 FSRs** (canales 0..13) mediante multiplexor CD74HC4067.
- **Comandos de control** por puerto serie Bluetooth: `START`, `STOP`, `CALIBRATE`, `CALIBRATE_POSTURE`.
- **Telemetría JSON periódica** (líneas terminadas en `\n`):
  - `values[]` (sensores)
  - `seatSum`, `backSum`
  - `angle` (estimado por balance izquierda/derecha)
  - `status` (`ok|alert|unknown`)
  - `alert` / `zoneAlert`
  - `zoneStatus` (ej. `"leaning_forward_or_on_edge"`, `"leaning_back"`, `"neutral"`)
- **Bluetooth Classic (Serial Port Profile)**: no se usan servicios BLE.

## Wiring (recommended)

- Use a `CD74HC4067` 16-channel analog multiplexer.
- Connect FSR outputs to MUX channels **0..13**.
- MUX `SIG` -> ESP32 ADC pin (e.g., `GPIO34`).
- MUX `S0..S3` -> ESP32 GPIOs (configured in the sketch as `25, 26, 27, 14`).
- Each FSR should be wired as a **voltage divider**:
  - One leg of the FSR to 3.3V.
  - The junction (`SIG` node) between FSR and a fixed resistor (e.g. 10k) to GND.
  - Read the junction with the multiplexer input.
  - Tune the fixed resistor value to your FSR model and expected pressure range.

Zone mapping in the provided sketch
- The sketch maps sensors `0..9` (10 sensors) to the seat (`asiento`) and sensors `10..13`
  (4 sensors) to the backrest (`respaldo`). If your physical wiring is different, update the
  constants at the top of `backsafe_fsr.ino`:
  - `SEAT_START` / `SEAT_END` (inclusive)
  - `BACK_START` / `BACK_END` (inclusive)

Telemetría JSON
- `values[]`, `seatSum`, `backSum`
- `angle` (estimado), `status` (`ok|alert|unknown`)
- `alert`, `zoneAlert`, `zoneStatus` (texto para mostrar “posicion actual” en la app)
- Índices/valores máximos: `seatMaxIndex`, `backMaxIndex`, etc.

Comandos por Bluetooth Serial
- `START` / `STOP` — inicia/detiene notificaciones periódicas.
- `CALIBRATE` — recalibra baseline sin carga.
- `CALIBRATE_POSTURE` — calibra postura correcta (sentarse bien y enviar).
- `SET <PARAM> <VALUE>` / `GET <PARAM>` — tuning opcional (`READ_INTERVAL_MS`, `ZONE_RATIO`, `EMA_ALPHA`, etc.).

## Components

- ESP32 dev board (any with ADC pin 34 recommended)
- CD74HC4067 multiplexer
- 14× FSR sensors
- 14× fixed resistors (10k recommended) for voltage dividers
- Wiring, breadboard or PCB, USB cable

## Software dependencies

- **Arduino core for ESP32**
- **BluetoothSerial** (incluido en el core de ESP32) — no requiere librerías externas.

## Flashing

1. Open `backsafe_fsr.ino` in Arduino IDE or PlatformIO.
2. Select your ESP32 board and correct serial port.
3. Compile and upload the sketch.

## How the protocol works

- La app escribe comandos en el puerto serie Bluetooth (`\n` al final).
- El ESP32 envía líneas JSON por el mismo enlace (terminadas en `\n`).

  Example payload (fields may be extended, but structure is similar):

  ```json
  {
    "ts": 1234567,
    "alert": true,
    "zoneAlert": true,
    "zoneStatus": "leaning_back",
    "occupied": true,
    "maxIndex": 5,
    "maxValue": 512,
    "seatSum": 1800,
    "backSum": 950,
    "seatMaxIndex": 6,
    "seatMaxValue": 400,
    "backMaxIndex": 11,
    "backMaxValue": 350,
    "values": [10, 20, 30, 40, 50, 512, 60, 70, 80, 90, 100, 110, 120, 130]
  }
