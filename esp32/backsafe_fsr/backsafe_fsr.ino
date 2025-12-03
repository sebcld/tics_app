/*
  Backsafe ESP32 - SEAT SENSORS MONITOR (with Multiplexer)
  Muestra solo los 10 sensores del asiento (0-9) en tiempo real
  Usa multiplexor CD74HC4067 para leer múltiples sensores
*/

#include <BluetoothSerial.h>

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error Bluetooth is not enabled!
#endif

BluetoothSerial SerialBT;

// Multiplexer pins (CD74HC4067) - CORRECTED
const int MUX_S0 = 25;       // Selector bit 0
const int MUX_S1 = 26;       // Selector bit 1
const int MUX_S2 = 27;       // Selector bit 2
const int MUX_S3 = 14;       // Selector bit 3
const int MUX_SIG_PIN = 34;  // Analog signal input
// EN pin connected to GND (always enabled)

const int NUM_SEAT_SENSORS = 10;
const int SAMPLES_PER_READ = 3;
const float EMA_ALPHA = 0.3f;

const char* BT_NAME = "Backsafe_Monitor";

// Baseline and EMA smoothing arrays
int baseline[NUM_SEAT_SENSORS];
float ema[NUM_SEAT_SENSORS];

bool bluetoothConnected = false;
bool monitoringActive = true;
unsigned long lastUpdate = 0;
const unsigned long UPDATE_INTERVAL = 100; // 500ms para que sea legible

// Display modes
enum DisplayMode {
  SIMPLE,      // Simple one line
  BAR_GRAPH,   // Bar graph
  GRID,        // 2x5 grid view
  JSON_MODE    // JSON for Bluetooth
};

DisplayMode currentMode = BAR_GRAPH;

void btCallback(esp_spp_cb_event_t event, esp_spp_cb_param_t *param) {
  if (event == ESP_SPP_SRV_OPEN_EVT) {
    Serial.println("Client Connected!");
    bluetoothConnected = true;
  } else if (event == ESP_SPP_CLOSE_EVT) {
    Serial.println("Client Disconnected!");
    bluetoothConnected = false;
  }
}

// Set multiplexer channel (0..15)
void setMuxChannel(int channel) {
  digitalWrite(MUX_S0, channel & 0x1);
  digitalWrite(MUX_S1, (channel >> 1) & 0x1);
  digitalWrite(MUX_S2, (channel >> 2) & 0x1);
  digitalWrite(MUX_S3, (channel >> 3) & 0x1);
}

// Read single sensor through multiplexer with averaging
int readRawSensor(int idx) {
  if (idx < 0 || idx >= NUM_SEAT_SENSORS) return 0;
  
  setMuxChannel(idx);
  delayMicroseconds(100); // Settle time for multiplexer
  
  long sum = 0;
  for (int i = 0; i < SAMPLES_PER_READ; i++) {
    sum += analogRead(MUX_SIG_PIN);
    delay(2);
  }
  
  return (int)(sum / SAMPLES_PER_READ);
}

// Read all seat sensors with EMA smoothing
void readSeatSensors(int outVals[]) {
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    int raw = readRawSensor(i);
    int norm = raw - baseline[i];
    if (norm < 0) norm = 0;
    
    // Apply EMA smoothing
    if (ema[i] <= 0.0f) {
      ema[i] = norm;
    } else {
      ema[i] = EMA_ALPHA * norm + (1.0f - EMA_ALPHA) * ema[i];
    }
    
    outVals[i] = (int)(ema[i] + 0.5f);
  }
}

// Calibrate baseline (call when seat is empty)
void calibrateBaseline() {
  Serial.println("\n=== CALIBRATING BASELINE ===");
  Serial.println("Please ensure seat is EMPTY...");
  delay(2000);
  
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    long sum = 0;
    for (int j = 0; j < 10; j++) {
      setMuxChannel(i);
      delayMicroseconds(100);
      sum += analogRead(MUX_SIG_PIN);
      delay(20);
    }
    baseline[i] = sum / 10;
    ema[i] = 0.0f;
    Serial.printf("Sensor %d baseline: %d\n", i, baseline[i]);
  }
  
  Serial.println("=== CALIBRATION COMPLETE ===\n");
}

void displaySimple(int values[]) {
  Serial.print("SEAT: ");
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    Serial.printf("%4d ", values[i]);
  }
  
  int total = 0;
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    total += values[i];
  }
  Serial.printf("| Total: %d\n", total);
}

void displayBarGraph(int values[]) {
  // Lineas en blanco para separar frames visualmente
  Serial.println("\n\n"); 
  Serial.println("+==================== SEAT SENSORS ====================+");
  
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    Serial.printf("S%d  ", i); // Espacios corregidos
    
    // Bar visual (scale 0-2000 to 0-50 characters)
    int barLength = map(values[i], 0, 2000, 0, 50);
    if (barLength > 50) barLength = 50;
    if (barLength < 0) barLength = 0;
    
    // Parte llena de la barra
    for (int j = 0; j < barLength; j++) {
      Serial.print("#");
    }
    
    // Parte vacia (alineacion)
    for (int j = barLength; j < 50; j++) {
      Serial.print(" ");
    }
    
    Serial.printf(" %4d\n", values[i]);
  }
  
  int total = 0;
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    total += values[i];
  }
  Serial.println("+======================================================+");
  Serial.printf("TOTAL: %d\n", total);
}

void displayGrid(int values[]) {
  Serial.println("\n\n"); // Separador visual
  Serial.println("+============== SEAT GRID VIEW ==============+");
  Serial.println("|       FRONT (hacia adelante)               |");
  Serial.println("+============================================+");
  
  // Row 1 (sensors 0-4)
  Serial.print("|  ");
  for (int i = 0; i < 5; i++) {
    Serial.printf("[%d:%4d] ", i, values[i]);
  }
  Serial.println("|");
  
  // Row 2 (sensors 5-9)
  Serial.print("|  ");
  for (int i = 5; i < NUM_SEAT_SENSORS; i++) {
    Serial.printf("[%d:%4d] ", i, values[i]);
  }
  Serial.println("|");
  
  Serial.println("+============================================+");
  Serial.println("|        BACK (hacia atras)                  |");
  
  // Calculate sums by side
  int left = values[0] + values[5];
  int center_left = values[1] + values[6];
  int center = values[2] + values[7];
  int center_right = values[3] + values[8];
  int right = values[4] + values[9];
  int total = left + center_left + center + center_right + right;
  
  Serial.println("+============================================+");
  Serial.printf("| L:%4d | CL:%4d | C:%4d | CR:%4d | R:%4d |\n", 
                left, center_left, center, center_right, right);
  Serial.printf("| TOTAL: %d                                  |\n", total);
  Serial.println("+============================================+\n");
}

void sendJSON(int values[]) {
  if (!bluetoothConnected) return;
  
  String json = "{";
  json += "\"type\":\"seat_data\",";
  json += "\"ts\":" + String(millis()) + ",";
  json += "\"values\":[";
  
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    json += String(values[i]);
    if (i < NUM_SEAT_SENSORS - 1) json += ",";
  }
  
  int total = 0;
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    total += values[i];
  }
  
  json += "],\"total\":" + String(total);
  json += "}";
  
  SerialBT.println(json);
  SerialBT.flush();
}

// NUEVA FUNCIÓN: envía datos al estilo
// { 
//   "DATA",
//   {85, 80, 95, 90, 90, 85, 75, 85, 80, 75}
// }
void sendAppDataPacket(int values[]) {
  if (!bluetoothConnected) return;

  String packet;
  packet.reserve(128);

  packet += "{\n  \"DATA\",\n  {";

  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    packet += String(values[i]);
    if (i < NUM_SEAT_SENSORS - 1) {
      packet += ", ";
    }
  }

  packet += "}\n}";

  SerialBT.println(packet);
  SerialBT.flush();

  // Opcional: también mostrar en el Serial normal para debug
  Serial.println("APP PACKET SENT:");
  Serial.println(packet);
}

void displayHeatmap(int values[]) {
  Serial.println("\n+========== SEAT HEATMAP ==========+");
  Serial.println("|      (Front -> Back)             |");
  Serial.println("+==================================+");
  
  for (int row = 0; row < 2; row++) {
    Serial.print("|  ");
    for (int col = 0; col < 5; col++) {
      int idx = row * 5 + col;
      int val = values[idx];
      
      // Choose symbol based on intensity
      char symbol;
      if (val < 50) symbol = '.';
      else if (val < 200) symbol = ':';
      else if (val < 500) symbol = '=';
      else if (val < 1000) symbol = '*';
      else symbol = '#';
      
      Serial.printf(" %c%4d ", symbol, val);
    }
    Serial.println("|");
  }
  
  Serial.println("+==================================+");
  Serial.println("Legend: . (0-49) : (50-199) = (200-499) * (500-999) # (1000+)\n");
}

void displayRawValues() {
  Serial.println("\n=== RAW SENSOR VALUES (no baseline) ===");
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    setMuxChannel(i);
    delayMicroseconds(100);
    int raw = analogRead(MUX_SIG_PIN);
    Serial.printf("S%d: RAW=%4d | BASELINE=%4d | DIFF=%4d\n", 
                  i, raw, baseline[i], raw - baseline[i]);
  }
  Serial.println("=======================================\n");
}

void processCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  
  if (cmd == "START") {
    monitoringActive = true;
    Serial.println("Monitoring STARTED");
    
  } else if (cmd == "STOP") {
    monitoringActive = false;
    Serial.println("Monitoring STOPPED");
    
  } else if (cmd == "CALIBRATE" || cmd == "CAL") {
    monitoringActive = false;
    calibrateBaseline();
    monitoringActive = true;
    
  } else if (cmd == "SIMPLE") {
    currentMode = SIMPLE;
    Serial.println("Display mode: SIMPLE");
    
  } else if (cmd == "BAR") {
    currentMode = BAR_GRAPH;
    Serial.println("Display mode: BAR GRAPH");
    
  } else if (cmd == "GRID") {
    currentMode = GRID;
    Serial.println("Display mode: GRID");
    
  } else if (cmd == "JSON") {
    currentMode = JSON_MODE;
    Serial.println("Display mode: JSON (Bluetooth only)");
    
  } else if (cmd == "BASELINE") {
    Serial.println("\n=== CURRENT BASELINE VALUES ===");
    for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
      Serial.printf("S%d: %d\n", i, baseline[i]);
    }
    Serial.println("===============================\n");
    
  } else if (cmd == "RAW") {
    displayRawValues();
    
  } else if (cmd == "TEST") {
    Serial.println("\n=== TESTING MULTIPLEXER ===");
    for (int i = 0; i < 16; i++) {
      setMuxChannel(i);
      delayMicroseconds(100);
      int val = analogRead(MUX_SIG_PIN);
      Serial.printf("Channel %2d: %4d\n", i, val);
      delay(100);
    }
    Serial.println("===========================\n");
    
  } else if (cmd == "HELP") {
    Serial.println("\n=== AVAILABLE COMMANDS ===");
    Serial.println("START     - Start monitoring");
    Serial.println("STOP      - Stop monitoring");
    Serial.println("CALIBRATE - Calibrate baseline (empty seat)");
    Serial.println("BASELINE  - Show baseline values");
    Serial.println("RAW       - Show raw sensor values");
    Serial.println("TEST      - Test all 16 mux channels");
    Serial.println("SIMPLE    - Simple one-line display");
    Serial.println("BAR       - Bar graph display");
    Serial.println("GRID      - Grid layout display");
    Serial.println("JSON      - JSON output (Bluetooth)");
    Serial.println("HELP      - Show this help");
    Serial.println("==========================\n");
    
  } else {
    Serial.println("Unknown command. Type 'HELP' for commands.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n");
  Serial.println("+========================================+");
  Serial.println("|  BACKSAFE - SEAT SENSORS MONITOR       |");
  Serial.println("|  Real-time display (Sensors 0-9)       |");
  Serial.println("|  Using CD74HC4067 Multiplexer          |");
  Serial.println("+========================================+");
  Serial.println();
  
  // Configure multiplexer pins
  pinMode(MUX_S0, OUTPUT);
  pinMode(MUX_S1, OUTPUT);
  pinMode(MUX_S2, OUTPUT);
  pinMode(MUX_S3, OUTPUT);
  pinMode(MUX_SIG_PIN, INPUT);
  
  Serial.println("Multiplexer Configuration:");
  Serial.println("+------------------+----------+");
  Serial.println("| Pin              | GPIO     |");
  Serial.println("+------------------+----------+");
  Serial.printf("| S0               | %2d       |\n", MUX_S0);
  Serial.printf("| S1               | %2d       |\n", MUX_S1);
  Serial.printf("| S2               | %2d       |\n", MUX_S2);
  Serial.printf("| S3               | %2d       |\n", MUX_S3);
  Serial.printf("| SIG              | %2d       |\n", MUX_SIG_PIN);
  Serial.println("| EN               | GND      |");
  Serial.println("| VCC              | 3.3V     |");
  Serial.println("+------------------+----------+");
  Serial.println();
  
  // Initialize baseline and EMA
  for (int i = 0; i < NUM_SEAT_SENSORS; i++) {
    baseline[i] = 0;
    ema[i] = 0.0f;
  }
  
  // Auto-calibrate on startup
  calibrateBaseline();
  
  // Initialize Bluetooth
  SerialBT.register_callback(btCallback);
  if (!SerialBT.begin(BT_NAME, false)) {
    Serial.println("Bluetooth initialization FAILED!");
  } else {
    Serial.println("Bluetooth initialized: " + String(BT_NAME));
  }
  
  Serial.println("\nDISPLAY MODES:");
  Serial.println("  SIMPLE - One line with values");
  Serial.println("  BAR    - Bar graph (default)");
  Serial.println("  GRID   - 2x5 grid layout");
  Serial.println("  JSON   - JSON output via Bluetooth");
  
  Serial.println("\nUSEFUL COMMANDS:");
  Serial.println("  CALIBRATE - Recalibrate (empty seat)");
  Serial.println("  RAW       - Show raw sensor readings");
  Serial.println("  TEST      - Test all mux channels");
  Serial.println("  HELP      - Show all commands");
  
  Serial.println("\nMonitoring started! Type 'STOP' to pause.\n");
}

void loop() {
  // Process commands from Serial
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    processCommand(cmd);
  }
  
  // Process commands from Bluetooth
  if (SerialBT.available()) {
    String cmd = SerialBT.readStringUntil('\n');
    processCommand(cmd);
  }
  
  // Update sensor readings
  if (monitoringActive && (millis() - lastUpdate >= UPDATE_INTERVAL)) {
    lastUpdate = millis();
    
    int sensorValues[NUM_SEAT_SENSORS];
    readSeatSensors(sensorValues);
    
    // Display according to current mode
    switch (currentMode) {
      case SIMPLE:
        displaySimple(sensorValues);
        break;
        
      case BAR_GRAPH:
        displayBarGraph(sensorValues);
        break;
        
      case GRID:
        displayGrid(sensorValues);
        break;
        
      case JSON_MODE:
        displaySimple(sensorValues);
        sendJSON(sensorValues);
        break;
    }

    // Enviar SIEMPRE el paquete para la app (si hay cliente BT)
    sendAppDataPacket(sensorValues);
    
    // Optional: show heatmap every 10 readings in GRID mode
    static int readCount = 0;
    if (currentMode == GRID && ++readCount >= 10) {
      readCount = 0;
      displayHeatmap(sensorValues);
    }
  }
  
  delay(10);
}
