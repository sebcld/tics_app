# Backsafe ESP32 — FSR Array Sketch

This folder contains an Arduino sketch for an ESP32 that reads 14 FSR sensors through
a CD74HC4067 multiplexer and sends posture telemetry via BLE to the mobile app.

## Features

- Reads **14 FSRs** (channels 0..13) through a 16-channel multiplexer (CD74HC4067).
- **Calibration command** (`CALIBRATE`) to set baselines with no load.
- **Periodic JSON notifications** with:
  - Per-sensor normalized values (`values[]`)
  - Occupancy detection (`occupied`)
  - Single-point “bad posture” detection (`alert`, `maxIndex`, `maxValue`)
  - Zone analysis for seat/back:
    - `seatSum`, `backSum`
    - `seatMaxIndex`, `seatMaxValue`
    - `backMaxIndex`, `backMaxValue`
    - `zoneAlert`, `zoneStatus` (`empty`, `neutral`, `leaning_back`, `leaning_forward_or_on_edge`)
- BLE service & characteristics match the app's `backsafeProtocol` defaults:
  - Service: `0000fff0-0000-1000-8000-00805f9b34fb`
  - Command char (WRITE / WRITE_NR): `0000fff1-0000-1000-8000-00805f9b34fb`
  - Notify char (NOTIFY): `0000fff2-0000-1000-8000-00805f9b34fb`

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

Notification JSON and new fields
- The device sends zone summaries in the notification JSON: `seatSum`, `backSum`,
  `seatMaxIndex`, `backMaxIndex`, plus `zoneAlert` and `zoneStatus` which indicate
  if the user is likely leaning back or forward.
- New fields added for compatibility with the app:
  - `status`: one of `ok`, `alert`, or `unknown`.
  - `angle`: approximate tilt estimate in degrees (float). This is an heuristic computed
    from the left/right balance of the seat sensors and is intended to give the app a
    coarse orientation metric (about +/-30 degrees range).

Runtime configuration commands (BLE)
- You can control runtime parameters over BLE by writing text commands to the command
  characteristic (`CHAR_COMMAND_UUID`). Supported commands:
  - `CALIBRATE` — re-sample baselines with no load.
  - `START` / `STOP` — enable/disable periodic telemetry notifications.
  - `SET <PARAM> <VALUE>` — set a tunable parameter. Supported params:
    - `READ_INTERVAL_MS` (ms, min ~50)
    - `ZONE_RATIO` (float)
    - `HIGH_PRESSURE_RATIO` (float)
    - `EMA_ALPHA` (float 0..1)
    Example: `SET READ_INTERVAL_MS 400`
  - `GET <PARAM>` — query current value. Example: `GET ZONE_RATIO`

The device responds to `SET`/`GET` with a small JSON ACK on the notify characteristic.
- `BACK_START` / `BACK_END` (inclusive)

The device sends zone summaries in the notification JSON:

- `seatSum`, `backSum`
- `seatMaxIndex`, `seatMaxValue`
- `backMaxIndex`, `backMaxValue`
- `zoneAlert` (boolean)
- `zoneStatus`:
  - `"empty"` — no one sitting (overall load below `MIN_OCCUPANCY`)
  - `"neutral"` — seated but no strong lean detected
  - `"leaning_back"` — backrest load dominates (beyond `ZONE_RATIO`)
  - `"leaning_forward_or_on_edge"` — seat load dominates (beyond `ZONE_RATIO`)

## Components

- ESP32 dev board (any with ADC pin 34 recommended)
- CD74HC4067 multiplexer
- 14× FSR sensors
- 14× fixed resistors (10k recommended) for voltage dividers
- Wiring, breadboard or PCB, USB cable

## Software dependencies

- **Arduino core for ESP32**
- **NimBLE-Arduino** library (install via Arduino Library Manager)
  - The sketch is written against NimBLE-Arduino’s API (server/characteristic callbacks with `NimBLEConnInfo` etc.).
  - Using `ESP32 BLE Arduino` instead would require code changes.

## Flashing

1. Open `backsafe_fsr.ino` in Arduino IDE or PlatformIO.
2. Install **NimBLE-Arduino** from Library Manager.
3. Select your ESP32 board and correct serial port.
4. Compile and upload the sketch.

## How the protocol works

- The mobile app writes commands (plain text UTF-8) to the **command characteristic**  
  (`0000fff1-0000-1000-8000-00805f9b34fb`).

  Supported commands:

  - `CALIBRATE`
    - Samples sensors with no load and stores baselines.
    - Resets the EMA smoothing state.
    - Sends an ACK notification:  
      `{"cmdAck":"CALIBRATE","ok":true}`
  - `START`
    - Enables periodic telemetry notifications.
  - `STOP`
    - Disables periodic telemetry notifications.

- The ESP32 sends **notifications** on the **notify characteristic**  
  (`0000fff2-0000-1000-8000-00805f9b34fb`) containing a compact JSON string.

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
