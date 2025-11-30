/*
  Backsafe ESP32 sketch
  - Reads 14 FSR sensors through a 16-channel multiplexer (CD74HC4067)
  - Calibrates baseline, smooths readings, detects bad posture when one sensor
    has significantly higher pressure than the others
  - Exposes BLE GATT service and characteristics compatible with the mobile app
    SERVICE_UUID  = 0000fff0-0000-1000-8000-00805f9b34fb
    CHAR_COMMAND   = 0000fff1-0000-1000-8000-00805f9b34fb (WRITE/WRITE_NR)
    CHAR_NOTIFY    = 0000fff2-0000-1000-8000-00805f9b34fb (NOTIFY)

  Requirements:
  - Arduino core for ESP32
  - NimBLE-Arduino library (recommended) or ESP32 BLE Arduino

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
static const char* SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
static const char* CHAR_COMMAND_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";
static const char* CHAR_NOTIFY_UUID = "0000fff2-0000-1000-8000-00805f9b34fb";

// Hardware config: multiplexer control pins and analog input
const int MUX_SIG_PIN = 34; // ADC pin connected to common SIG of CD74HC4067
const int MUX_S0 = 25;
const int MUX_S1 = 26;
const int MUX_S2 = 27;
const int MUX_S3 = 14;

const int NUM_SENSORS = 14; // using channels 0..13 of the mux

// Sampling / smoothing / thresholds
const int SAMPLES_PER_READ = 6;       // average samples per sensor reading
const int READ_INTERVAL_MS = 200;     // millis between notifications when running
const float HIGH_PRESSURE_RATIO = 1.8; // max > othersMean * ratio => alert
const int MIN_OCCUPANCY = 50;         // total normalized sum below this => empty

// Calibration arrays
int baseline[NUM_SENSORS]; // baseline (no load) raw ADC
bool calibrated = false;

// smoothing: simple exponential moving average
float ema[NUM_SENSORS];
const float EMA_ALPHA = 0.4;

// BLE objects
NimBLEServer* pServer = nullptr;
NimBLEService* pService = nullptr;
NimBLECharacteristic* pCmdChar = nullptr;
NimBLECharacteristic* pNotifyChar = nullptr;

volatile bool notifyEnabled = false;
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
    int raw = readRawSensor(i);
    int norm = raw - baseline[i];
    if (norm < 0) norm = 0;
    // apply EMA smoothing
    if (!isnan(ema[i]) && ema[i] > 0) {
      ema[i] = EMA_ALPHA * norm + (1.0 - EMA_ALPHA) * ema[i];
    } else {
      ema[i] = norm;
    }
    outVals[i] = (int)round(ema[i]);
  }
}

// Simple posture detection: check if one sensor is much higher than others
bool detectBadPosture(int vals[], int &maxIndex, int &maxValue, bool &occupied) {
  long total = 0;
  maxIndex = 0; maxValue = 0;
  for (int i = 0; i < NUM_SENSORS; ++i) {
    total += vals[i];
    if (vals[i] > maxValue) { maxValue = vals[i]; maxIndex = i; }
  }
  if (total < MIN_OCCUPANCY) { occupied = false; return false; }
  occupied = true;
  long othersSum = total - maxValue;
  float othersMean = (NUM_SENSORS > 1) ? (float)othersSum / (NUM_SENSORS - 1) : 0.0;
  if (othersMean <= 0.0) { return false; }
  // If the single max is significantly higher than mean of others, flag alert
  if ((float)maxValue > othersMean * HIGH_PRESSURE_RATIO && maxValue > 30) {
    return true;
  }
  return false;
}

// Create a JSON payload and notify
void sendNotificationPayload(int vals[]) {
  int maxIdx, maxVal; bool occupied;
  bool alert = detectBadPosture(vals, maxIdx, maxVal, occupied);
  unsigned long ts = millis();

  // Build JSON string (compact)
  String payload = "{";
  payload += "\"ts\":" + String(ts);
  payload += ",\"alert\":" + String(alert ? "true" : "false");
  payload += ",\"occupied\":" + String(occupied ? "true" : "false");
  payload += ",\"maxIndex\":" + String(maxIdx);
  payload += ",\"maxValue\":" + String(maxVal);
  payload += ",\"values\": [";
  for (int i = 0; i < NUM_SENSORS; ++i) {
    payload += String(vals[i]);
    if (i < NUM_SENSORS - 1) payload += ",";
  }
  payload += "]}";

  // Send as raw bytes; central will receive base64-encoded representation
  if (pNotifyChar && pNotifyChar->subscribed()) {
    pNotifyChar->setValue((uint8_t*)payload.c_str(), payload.length());
    pNotifyChar->notify();
  }
}

// BLE command callback
class CommandCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChar) override {
    std::string s = pChar->getValue();
    if (s.length() == 0) return;
    String cmd = String(s.c_str());
    cmd.trim();
    cmd.toUpperCase();
    Serial.println("CMD: " + cmd);
    if (cmd == "CALIBRATE") {
      // Recalibrate baselines
      Serial.println("Calibrating baselines...");
      // take several readings and average
      const int CAL_SAMPLES = 30;
      long sums[NUM_SENSORS] = {0};
      for (int t=0;t<CAL_SAMPLES;++t) {
        for (int i=0;i<NUM_SENSORS;++i) {
          int r = readRawSensor(i);
          sums[i] += r;
        }
        delay(20);
      }
      for (int i=0;i<NUM_SENSORS;++i) {
        baseline[i] = sums[i] / CAL_SAMPLES;
        ema[i] = 0; // reset smoothing
      }
      calibrated = true;
      // send ack
      String ack = "{\"cmdAck\":\"CALIBRATE\",\"ok\":true}";
      if (pNotifyChar && pNotifyChar->subscribed()) {
        pNotifyChar->setValue((uint8_t*)ack.c_str(), ack.length());
        pNotifyChar->notify();
      }
    } else if (cmd == "START") {
      isRunning = true;
    } else if (cmd == "STOP") {
      isRunning = false;
    }
  }
};

// Server callbacks to track subscription/connect
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer) override {
    Serial.println("Client connected");
  }
  void onDisconnect(NimBLEServer* pServer) override {
    Serial.println("Client disconnected");
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

  pService->start();
  NimBLEAdvertising* pAdv = NimBLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->start();

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
  analogSetPinAttenuation(MUX_SIG_PIN, ADC_11db); // allow full range up to 3.3V

  // default baseline: read a few times to initialize
  for (int i=0;i<NUM_SENSORS;++i) baseline[i] = 0;
  Serial.println("Initial quick calibration (no-load)");
  const int INIT_SAMPLES = 20;
  long sums[NUM_SENSORS] = {0};
  for (int t=0;t<INIT_SAMPLES;++t) {
    for (int i=0;i<NUM_SENSORS;++i) sums[i] += readRawSensor(i);
    delay(20);
  }
  for (int i=0;i<NUM_SENSORS;++i) baseline[i] = sums[i] / INIT_SAMPLES;
  calibrated = true;

  // init EMA
  for (int i=0;i<NUM_SENSORS;++i) ema[i] = 0;

  setupBLE();
}

void loop() {
  // Handle periodic notification
  if (isRunning && millis() - lastNotify >= READ_INTERVAL_MS) {
    lastNotify = millis();
    int vals[NUM_SENSORS];
    readAllSensors(vals);
    sendNotificationPayload(vals);
  }
  // small yield
  delay(10);
}
