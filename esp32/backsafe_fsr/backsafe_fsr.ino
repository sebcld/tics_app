/*
  Backsafe ESP32 sketch - TEST VERSION (C0, C1, C2 ONLY)
  - Reads only 3 FSR sensors (Multiplexer channels 0, 1, 2)
  - Prints values to Serial Monitor for debugging
  - Still exposes BLE for App connection
*/

#include <NimBLEDevice.h>

// UUIDs matching the app
static const char* SERVICE_UUID       = "0000fff0-0000-1000-8000-00805f9b34fb";
static const char* CHAR_COMMAND_UUID  = "0000fff1-0000-1000-8000-00805f9b34fb";
static const char* CHAR_NOTIFY_UUID   = "0000fff2-0000-1000-8000-00805f9b34fb";

// Hardware config: multiplexer control pins and analog input
const int MUX_SIG_PIN = 34; 
const int MUX_S0 = 25;
const int MUX_S1 = 26;
const int MUX_S2 = 27;
const int MUX_S3 = 14;

// --- CHANGED FOR TESTING ---
const int NUM_SENSORS = 3; // ONLY READ CHANNELS 0, 1, 2

// Sampling / smoothing / thresholds
const int   SAMPLES_PER_READ    = 6;      
int         READ_INTERVAL_MS    = 500;    
float       HIGH_PRESSURE_RATIO = 1.6f;   
const int   MIN_OCCUPANCY       = 50;     

// Zone mapping: ADJUSTED FOR 3 SENSORS
const int SEAT_START = 0;
const int SEAT_END   = 2;   // Sensors 0, 1, 2 are Seat
const int BACK_START = 10;  // Won't be reached
const int BACK_END   = 13;  // Won't be reached
float ZONE_RATIO = 1.5f; 

// Calibration arrays
int  baseline[NUM_SENSORS]; 
bool calibrated = false;

// smoothing
float ema[NUM_SENSORS];
float EMA_ALPHA = 0.4f;

// BLE objects
NimBLEServer* pServer      = nullptr;
NimBLEService* pService     = nullptr;
NimBLECharacteristic* pCmdChar     = nullptr;
NimBLECharacteristic* pNotifyChar  = nullptr;

volatile bool isRunning = true; 
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

// Read all sensors with smoothing
void readAllSensors(int outVals[]) {
  for (int i = 0; i < NUM_SENSORS; ++i) {
    int raw  = readRawSensor(i);
    int norm = raw - baseline[i];
    if (norm < 0) norm = 0;

    if (ema[i] <= 0.0f) {
      ema[i] = norm;
    } else {
      ema[i] = EMA_ALPHA * norm + (1.0f - EMA_ALPHA) * ema[i];
    }
    outVals[i] = (int)(ema[i] + 0.5f);
  }
}

// Simple posture detection
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

  // Build JSON string
  String payload = "{";
  payload += "\"ts\":" + String(ts);
  
  // Angle calc (simplified for 3 sensors)
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
    angle = ((float)rightSum - (float)leftSum) / (float)denom * 30.0f; 
  }

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

  if (pNotifyChar) {
    pNotifyChar->setValue((uint8_t*)payload.c_str(), payload.length());
    pNotifyChar->notify();
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
        ema[i]      = 0.0f; 
      }
      calibrated = true;

      String ack = "{\"cmdAck\":\"CALIBRATE\",\"ok\":true}";
      if (pNotifyChar) {
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

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
    Serial.println("Client connected");
  }

  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    Serial.println("Client disconnected");
    NimBLEDevice::startAdvertising();
  }
};

void setupBLE() {
  NimBLEDevice::init("Backsafe-ESP32-TEST"); // Renamed device for clarity
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
  pAdv->start(); 

  Serial.println("BLE advertising started");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Backsafe ESP32 TEST MODE (C0-C2)...");

  pinMode(MUX_S0, OUTPUT);
  pinMode(MUX_S1, OUTPUT);
  pinMode(MUX_S2, OUTPUT);
  pinMode(MUX_S3, OUTPUT);

  analogSetPinAttenuation(MUX_SIG_PIN, ADC_11db); 

  for (int i = 0; i < NUM_SENSORS; ++i) {
    baseline[i] = 0;
    ema[i]      = 0.0f;
  }

  Serial.println("Initial quick calibration...");
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
  if (isRunning && (millis() - lastNotify >= READ_INTERVAL_MS)) {
    lastNotify = millis();
    int vals[NUM_SENSORS];
    readAllSensors(vals);
    sendNotificationPayload(vals);
    
    // --- DEBUGGING OUTPUT FOR SERIAL MONITOR ---
    Serial.print("C0: "); Serial.print(vals[0]);
    Serial.print(" | C1: "); Serial.print(vals[1]);
    Serial.print(" | C2: "); Serial.println(vals[2]);
  }

  delay(10);
}