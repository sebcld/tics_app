/*
  Backsafe ESP32 sketch
  - Reads 14 FSR sensors through a 16-channel multiplexer (CD74HC4067)
  - Calibrates baseline, smooths readings, detects bad posture when one sensor
    has significantly higher pressure than the others
  - Exposes BLE GATT service and characteristics compatible with the mobile app
    SERVICE_UUID   = 0000fff0-0000-1000-8000-00805f9b34fb
    CHAR_COMMAND   = 0000fff1-0000-1000-8000-00805f9b34fb (WRITE/WRITE_NR)
    CHAR_NOTIFY    = 0000fff2-0000-1000-8000-00805f9b34fb (NOTIFY)

  Requirements:
  - Arduino core for ESP32
  - NimBLE-Arduino library

  Wiring (example using CD74HC4067):
  - SIG pin of the multiplexer -> ESP32 analog pin (e.g., 34)
  - S0,S1,S2,S3 -> any digital GPIOs (4 pins for channel select)
  - Connect FSRs to multiplexer channels 0..13
  - Vcc to 3.3V, GND to GND
  - Use pulldown/up resistor network per FSR: common design is a voltage divider
    with a fixed resistor (e.g., 10k) and FSR to 3.3V; read the SIG node.

  This sketch sends notifications as JSON strings (UTF-8). Example payload:
    {"ts":1670000000,"alert":true,"maxIndex":5,"maxValue":512,"values":[120,130,...]}
*/

#include <NimBLEDevice.h>

// UUIDs matching the app
static const char* SERVICE_UUID       = "0000fff0-0000-1000-8000-00805f9b34fb";
static const char* CHAR_COMMAND_UUID  = "0000fff1-0000-1000-8000-00805f9b34fb";
static const char* CHAR_NOTIFY_UUID   = "0000fff2-0000-1000-8000-00805f9b34fb";

// Hardware config: multiplexer control pins and analog input
const int MUX_SIG_PIN = 34; // ADC pin connected to common SIG of CD74HC4067
const int MUX_S0 = 25;
const int MUX_S1 = 26;
const int MUX_S2 = 27;
const int MUX_S3 = 14;

const int NUM_SENSORS = 14; // using channels 0..13 of the mux

// Sampling / smoothing / thresholds (tunable)
const int   SAMPLES_PER_READ    = 6;      // average samples per sensor reading
int         READ_INTERVAL_MS    = 500;    // millis between notifications when running (default increased to reduce traffic)
float       HIGH_PRESSURE_RATIO = 1.6f;   // max > othersMean * ratio => alert (slightly more sensitive)
const int   MIN_OCCUPANCY       = 50;     // total normalized sum below this => empty

// Zone mapping: most sensors on seat (asiento), remaining on backrest (respaldo)
// Adjust indices if your wiring is different
const int SEAT_START = 0;
const int SEAT_END   = 9;   // sensors 0..9 => asiento (10 sensors)
const int BACK_START = 10;
const int BACK_END   = 13;  // sensors 10..13 => respaldo (4 sensors)
float ZONE_RATIO = 1.5f; // back/seat ratio threshold to consider leaning (tunable)

// Calibration arrays
int  baseline[NUM_SENSORS]; // baseline (no load) raw ADC
bool calibrated = false;

// smoothing: simple exponential moving average
float ema[NUM_SENSORS];
float EMA_ALPHA = 0.4f;

// BLE objects
NimBLEServer*         pServer      = nullptr;
NimBLEService*        pService     = nullptr;
NimBLECharacteristic* pCmdChar     = nullptr;
NimBLECharacteristic* pNotifyChar  = nullptr;

// (no server-side subscription tracking; client should subscribe before sending START)

// Control flags
volatile bool isRunning = true; // whether to send periodic notifications

unsigned long lastNotify = 0;

// Helper: set multiplexer channel (0..15)
void setMuxChannel(int channel) {
  digitalWrite(MUX_S0, channel & 0x1);
  digitalWrite(MUX_S1, (channel >> 1) & 0x1);
  digitalWrite(MUX_S2, (channel >> 2) & 0x1);
  digitalWrite(MUX_S3, (channel >> 3) & 0x1);
}

int readRawSensor(int idx) {
  if (idx < 0 || idx >= NUM_SENSORS) return 0;
  int ch = idx; // channel on mux
  setMuxChannel(ch);
  delayMicroseconds(50); // settle
  long s = 0;
  for (int i = 0; i < SAMPLES_PER_READ; ++i) {
    s += analogRead(MUX_SIG_PIN);
    delay(2);
  }
  return (int)(s / SAMPLES_PER_READ);
}

// Read all sensors with smoothing and return normalized values (raw-baseline, clipped >=0)
void readAllSensors(int outVals[]) {
  for (int i = 0; i < NUM_SENSORS; ++i) {
    int raw  = readRawSensor(i);
    int norm = raw - baseline[i];
    if (norm < 0) norm = 0;

    // apply EMA smoothing; first time just set to norm
    if (ema[i] <= 0.0f) {
      ema[i] = norm;
    } else {
      ema[i] = EMA_ALPHA * norm + (1.0f - EMA_ALPHA) * ema[i];
    }

    // simple rounding without using round()
    outVals[i] = (int)(ema[i] + 0.5f);
  }
}

// Simple posture detection: check if one sensor is much higher than others
bool detectBadPosture(int vals[], int &maxIndex, int &maxValue, bool &occupied) {
  long total = 0;
  maxIndex = 0;
  maxValue = 0;

  for (int i = 0; i < NUM_SENSORS; ++i) {
    total += vals[i];
    if (vals[i] > maxValue) {
      maxValue = vals[i];
      maxIndex = i;
    }
  }

  if (total < MIN_OCCUPANCY) {
    occupied = false;
    return false;
  }

  occupied = true;
  long  othersSum  = total - maxValue;
  float othersMean = (NUM_SENSORS > 1) ? (float)othersSum / (NUM_SENSORS - 1) : 0.0f;
  if (othersMean <= 0.0f) {
    return false;
  }

  // If the single max is significantly higher than mean of others, flag alert
  if ((float)maxValue > othersMean * HIGH_PRESSURE_RATIO && maxValue > 30) {
    return true;
  }
  return false;
}

// Create a JSON payload and notify
void sendNotificationPayload(int vals[]) {
  int  maxIdx, maxVal;
  bool occupied;
  bool alert = detectBadPosture(vals, maxIdx, maxVal, occupied);
  unsigned long ts = millis();

  // Compute zone sums and maxima
  long seatSum = 0, backSum = 0;
  int seatMaxIdx = -1, seatMaxVal = 0;
  int backMaxIdx = -1, backMaxVal = 0;

  for (int i = 0; i < NUM_SENSORS; ++i) {
    if (i >= SEAT_START && i <= SEAT_END) {
      seatSum += vals[i];
      if (vals[i] > seatMaxVal) {
        seatMaxVal = vals[i];
        seatMaxIdx = i;
      }
    } else if (i >= BACK_START && i <= BACK_END) {
      backSum += vals[i];
      if (vals[i] > backMaxVal) {
        backMaxVal = vals[i];
        backMaxIdx = i;
      }
    }
  }

  // Zone alert: if backSum significantly greater than seatSum => leaning back
  bool   zoneAlert  = false;
  String zoneStatus = "neutral";

  if (seatSum + backSum < MIN_OCCUPANCY) {
    zoneStatus = "empty";
  } else if ((float)backSum > (float)seatSum * ZONE_RATIO && backSum > 30) {
    zoneAlert  = true;
    zoneStatus = "leaning_back";
  } else if ((float)seatSum > (float)backSum * ZONE_RATIO && seatSum > 30) {
    zoneAlert  = true;
    zoneStatus = "leaning_forward_or_on_edge";
  }

  // Build JSON string (compact) including zone summaries
  String payload = "{";
  payload += "\"ts\":" + String(ts);
  // compute approximate 'angle' using left/right seat sums (degrees)
  int seatCount = min(SEAT_END - SEAT_START + 1, NUM_SENSORS);
  int leftCount = seatCount / 2;
  long leftSum = 0, rightSum = 0;
  for (int i = 0; i < seatCount; ++i) {
    int v = vals[SEAT_START + i];
    if (i < leftCount) leftSum += v; else rightSum += v;
  }
  float angle = 0.0f;
  long denom = leftSum + rightSum;
  if (denom > 0) {
    angle = ((float)rightSum - (float)leftSum) / (float)denom * 30.0f; // +/- ~30 degrees
  }
  // status: prefer explicit alert flags, else ok/unknown
  String status = "unknown";
  if (!occupied) status = "unknown";
  else if (alert || zoneAlert) status = "alert";
  else status = "ok";

  payload += ",\"alert\":" + String(alert ? "true" : "false");
  payload += ",\"status\":\"" + status + "\"";
  payload += ",\"angle\":" + String(angle, 2);
  payload += ",\"zoneAlert\":" + String(zoneAlert ? "true" : "false");
  payload += ",\"zoneStatus\":\"" + zoneStatus + "\"";
  payload += ",\"occupied\":" + String(occupied ? "true" : "false");
  payload += ",\"maxIndex\":" + String(maxIdx);
  payload += ",\"maxValue\":" + String(maxVal);
  payload += ",\"seatSum\":" + String(seatSum);
  payload += ",\"backSum\":" + String(backSum);
  payload += ",\"seatMaxIndex\":" + String(seatMaxIdx);
  payload += ",\"seatMaxValue\":" + String(seatMaxVal);
  payload += ",\"backMaxIndex\":" + String(backMaxIdx);
  payload += ",\"backMaxValue\":" + String(backMaxVal);
  payload += ",\"values\":[";
  for (int i = 0; i < NUM_SENSORS; ++i) {
    payload += String(vals[i]);
    if (i < NUM_SENSORS - 1) payload += ",";
  }
  payload += "]}";

  // Send as raw bytes; central will receive JSON
  Serial.println("Sending notification payload: " + payload);
  if (pNotifyChar) {
    Serial.println("Notify attempt (server does not track subscription state)");
    pNotifyChar->setValue((uint8_t*)payload.c_str(), payload.length());
    pNotifyChar->notify();
    Serial.println("Notify sent");
  }
}

// BLE command callback
class CommandCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChar, NimBLEConnInfo& connInfo) override {
    std::string s = pChar->getValue();
    if (s.length() == 0) return;

    String cmd = String(s.c_str());
    cmd.trim();
    cmd.toUpperCase();
    Serial.println("CMD: " + cmd);

    if (cmd == "CALIBRATE") {
      // Recalibrate baselines
      Serial.println("Calibrating baselines...");
      const int CAL_SAMPLES = 30;
      long sums[NUM_SENSORS] = {0};

      for (int t = 0; t < CAL_SAMPLES; ++t) {
        for (int i = 0; i < NUM_SENSORS; ++i) {
          int r = readRawSensor(i);
          sums[i] += r;
        }
        delay(20);
      }

      for (int i = 0; i < NUM_SENSORS; ++i) {
        baseline[i] = sums[i] / CAL_SAMPLES;
        ema[i]      = 0.0f; // reset smoothing
      }
      calibrated = true;

      // send ack
      String ack = "{\"cmdAck\":\"CALIBRATE\",\"ok\":true}";
      if (pNotifyChar) {
        pNotifyChar->setValue((uint8_t*)ack.c_str(), ack.length());
        pNotifyChar->notify();
      }
    } else if (cmd == "START") {
      isRunning = true;
      // send ack and an immediate snapshot
      String ackStart = "{\"cmdAck\":\"START\",\"ok\":true}";
      if (pNotifyChar) {
        pNotifyChar->setValue((uint8_t*)ackStart.c_str(), ackStart.length());
        pNotifyChar->notify();
      }
      // send an immediate telemetry snapshot
      int valsNow[NUM_SENSORS];
      readAllSensors(valsNow);
      sendNotificationPayload(valsNow);
    } else if (cmd == "STOP") {
      isRunning = false;
      String ackStop = "{\"cmdAck\":\"STOP\",\"ok\":true}";
      if (pNotifyChar) {
        pNotifyChar->setValue((uint8_t*)ackStop.c_str(), ackStop.length());
        pNotifyChar->notify();
      }
    } else if (cmd.startsWith("SET ")) {
      // Format: SET <PARAM> <VALUE>
      // e.g. "SET READ_INTERVAL_MS 400" or "SET ZONE_RATIO 1.6"
      int firstSpace = cmd.indexOf(' ');
      int secondSpace = cmd.indexOf(' ', firstSpace + 1);
      if (firstSpace > 0 && secondSpace > firstSpace) {
        String param = cmd.substring(firstSpace + 1, secondSpace);
        String valStr = cmd.substring(secondSpace + 1);
        valStr.trim();
        param.trim();
        if (param == "READ_INTERVAL_MS") {
          int v = valStr.toInt();
          if (v > 50) READ_INTERVAL_MS = v;
        } else if (param == "ZONE_RATIO") {
          float v = valStr.toFloat();
          if (v > 0.5f && v < 10.0f) ZONE_RATIO = v;
        } else if (param == "HIGH_PRESSURE_RATIO") {
          float v = valStr.toFloat();
          if (v > 1.0f && v < 10.0f) HIGH_PRESSURE_RATIO = v;
        } else if (param == "EMA_ALPHA") {
          float v = valStr.toFloat();
          if (v > 0.0f && v <= 1.0f) {
            // EMA_ALPHA is const; update underlying behavior by using a mutable variable
            // For simplicity we cast away constness (safe here) - update value used in calculations
            *((float*)&EMA_ALPHA) = v;
          }
        }
        // send back current params as ack
        String ack = "{\"cmdAck\":\"SET\",\"param\":\"" + param + "\",\"value\":\"" + valStr + "\"}";
        if (pNotifyChar) {
          pNotifyChar->setValue((uint8_t*)ack.c_str(), ack.length());
          pNotifyChar->notify();
        }
      }
    } else if (cmd.startsWith("GET ")) {
      String param = cmd.substring(4);
      param.trim();
      String val = "";
      if (param == "READ_INTERVAL_MS") val = String(READ_INTERVAL_MS);
      else if (param == "ZONE_RATIO") val = String(ZONE_RATIO, 2);
      else if (param == "HIGH_PRESSURE_RATIO") val = String(HIGH_PRESSURE_RATIO, 2);
      else if (param == "EMA_ALPHA") val = String(EMA_ALPHA, 2);
      else val = "unknown";
      String ack = "{\"cmdAck\":\"GET\",\"param\":\"" + param + "\",\"value\":\"" + val + "\"}";
      if (pNotifyChar) {
        pNotifyChar->setValue((uint8_t*)ack.c_str(), ack.length());
        pNotifyChar->notify();
      }
    }
  }
};

// Server callbacks to track subscription/connect
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
    Serial.println("Client connected");
  }

  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    Serial.println("Client disconnected");
    // Restart advertising so another client can connect
    NimBLEDevice::startAdvertising();
  }
};

void setupBLE() {
  NimBLEDevice::init("Backsafe-ESP32");
  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  pService = pServer->createService(SERVICE_UUID);

  pCmdChar = pService->createCharacteristic(
    CHAR_COMMAND_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
  );
  pCmdChar->setCallbacks(new CommandCallbacks());

  pNotifyChar = pService->createCharacteristic(
    CHAR_NOTIFY_UUID,
    NIMBLE_PROPERTY::NOTIFY
  );
  // No server-side subscription tracking. The client should subscribe before START.

  pService->start();

  NimBLEAdvertising* pAdv = NimBLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  // Some versions of NimBLE-Arduino don't have setScanResponse(bool),
  // so we just don't call it here.

  pAdv->start(); // or NimBLEDevice::startAdvertising();

  Serial.println("BLE advertising started");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Backsafe ESP32 starting...");

  // configure mux pins
  pinMode(MUX_S0, OUTPUT);
  pinMode(MUX_S1, OUTPUT);
  pinMode(MUX_S2, OUTPUT);
  pinMode(MUX_S3, OUTPUT);

  // configure ADC
  analogSetPinAttenuation(MUX_SIG_PIN, ADC_11db); // allow full range up to ~3.3V

  // default baseline: read a few times to initialize
  for (int i = 0; i < NUM_SENSORS; ++i) {
    baseline[i] = 0;
    ema[i]      = 0.0f;
  }

  Serial.println("Initial quick calibration (no-load)");
  const int INIT_SAMPLES = 20;
  long sums[NUM_SENSORS] = {0};

  for (int t = 0; t < INIT_SAMPLES; ++t) {
    for (int i = 0; i < NUM_SENSORS; ++i) {
      sums[i] += readRawSensor(i);
    }
    delay(20);
  }

  for (int i = 0; i < NUM_SENSORS; ++i) {
    baseline[i] = sums[i] / INIT_SAMPLES;
  }
  calibrated = true;

  setupBLE();
}

void loop() {
  // Handle periodic notification
  if (isRunning && (millis() - lastNotify >= READ_INTERVAL_MS)) {
    lastNotify = millis();
    int vals[NUM_SENSORS];
    readAllSensors(vals);
    sendNotificationPayload(vals);
  }

  // small yield
  delay(10);
}
