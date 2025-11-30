# Backsafe ESP32 — FSR Array Sketch

This folder contains an Arduino sketch for an ESP32 that reads 14 FSR sensors through
a CD74HC4067 multiplexer and sends posture telemetry via BLE to the mobile app.

Features
- Reads 14 FSRs (channels 0..13) through a 16-channel multiplexer (CD74HC4067).
- Calibration command (`CALIBRATE`) to set baselines with no load.
- Periodic JSON notifications with per-sensor normalized values, occupancy and alert flag.
- BLE service & characteristics match the app's `backsafeProtocol` defaults:
  - Service: `0000fff0-0000-1000-8000-00805f9b34fb`
  - Command char (WRITE): `0000fff1-0000-1000-8000-00805f9b34fb`
  - Notify char (NOTIFY): `0000fff2-0000-1000-8000-00805f9b34fb`

Wiring (recommended)
- Use a `CD74HC4067` 16-channel analog multiplexer.
- Connect FSR outputs to MUX channels 0..13.
- MUX `SIG` -> ESP32 ADC pin (e.g., `GPIO34`).
- MUX `S0..S3` -> ESP32 GPIOs (configured in the sketch as `25,26,27,14`).
- Each FSR should be wired as a voltage divider: one leg to 3.3V and other leg to the SIG node
  through the FSR, with a fixed resistor (e.g., 10k) to ground — tune resistor to your sensors.

Components
- ESP32 (any board with ADC pin 34 recommended)
- CD74HC4067 multiplexer
- 14x FSR sensors
- 14x fixed resistors (10k recommended) for voltage dividers
- Wiring, breadboard or PCB, USB cable

Software dependencies
- Arduino core for ESP32
- NimBLE-Arduino library (install via Library Manager) — used in the sketch

Flashing
1. Open `backsafe_fsr.ino` in Arduino IDE or PlatformIO.
2. Install `NimBLE-Arduino` (or change to `ESP32 BLE Arduino` if you prefer).
3. Select your ESP32 board, set correct flash settings, and upload.

How the protocol works
- The mobile app writes commands (plain text UTF-8) to the command characteristic. Supported
  commands implemented in the sketch: `CALIBRATE`, `START`, `STOP`.
  - `CALIBRATE` will sample sensors with no load and store baselines.
  - `START`/`STOP` toggle periodic telemetry notifications.
- The peripheral sends notifications containing a compact JSON string. Example:

  {"ts":1234567,"alert":true,"occupied":true,"maxIndex":5,"maxValue":512,"values":[10,20,...]}

- The app decodes the BLE characteristic value (the platform provides it base64-encoded; the
  app decodes base64 and treats the text as UTF-8). `parseNotifyPayload` in the app expects
  JSON with `angle/alert/status` but will still accept the alert boolean and values array. You
  can adapt the app parser or the ESP32 payload format if you prefer different fields.

Notes & tuning
- By default the sketch uses a simple heuristic: if the largest sensor value is greater than
  `HIGH_PRESSURE_RATIO * mean(others)` then the occupant is considered "badly seated" and
  `alert=true` is sent. Try `HIGH_PRESSURE_RATIO=1.6..2.2` depending on your cushion layout.
- To reduce noise, the sketch uses a small EMA smoothing and averages multiple ADC samples.
- JSON with 14 values can exceed the default ATT MTU (20 bytes); modern phones and BLE stacks
  will negotiate higher MTU but if you see fragmentation issues reduce payload size (e.g., send
  only top-k sensors or use a compact binary format).

Testing
- Use `nRF Connect` (Android/iOS) to inspect advertisement, service and characteristics.
- From the app: call `scanAndConnect()` then `subscribeNotifications(cb)` to receive telemetry.
  You can send `writeCommand('CALIBRATE')` from the app to calibrate.

Next steps / improvements
- Add binary payload format for high-rate telemetry.
- Implement left/right and front/back symmetry checks for more precise posture alarms.
- Persist calibration to SPIFFS or NVS to keep it after reboot.
