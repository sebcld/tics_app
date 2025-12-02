/*
  Backsafe ESP32 - BLUETOOTH CLASSIC (SPP)
  Usa Bluetooth Classic en lugar de BLE para evitar limitación de 20 bytes
  Simula diferentes estados de postura para testear notificaciones
  No requiere sensores físicos conectados
*/

#include <BluetoothSerial.h>

// Crear objeto Serial Bluetooth
BluetoothSerial SerialBT;

const int NUM_SENSORS = 14;
const char* BT_NAME = "Backsafe_ESP32";

volatile bool isRunning = true;
unsigned long lastNotify = 0;
int testScenario = 1; // COMIENZA EN ESCENARIO 1 (Good Posture - OK)

// Escenarios de prueba
struct TestScenario {
  String name;
  bool occupied;
  bool alert;
  String status;
  float angle;
  String zoneStatus;
  int seatSum;
  int backSum;
  int values[14];
};

TestScenario scenarios[] = {
  // Escenario 0: Silla vacía
  {
    "Empty Chair",
    false, false, "unknown", 0.0f, "empty", 0, 0,
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
  },
  
  // Escenario 1: Sentado correctamente (postura OK)
  {
    "Good Posture - Centered",
    true, false, "ok", 0.0f, "neutral", 800, 200,
    {80, 85, 90, 85, 80, 75, 70, 80, 85, 90, 50, 50, 50, 50}
  },
  
  // Escenario 2: Inclinado hacia adelante (mala postura)
  {
    "Leaning Forward",
    true, true, "alert", 0.0f, "leaning_forward_or_on_edge", 950, 50,
    {120, 130, 140, 135, 125, 110, 100, 120, 130, 140, 10, 15, 10, 15}
  },
  
  // Escenario 3: Inclinado hacia atrás (mala postura)
  {
    "Leaning Back",
    true, true, "alert", 0.0f, "leaning_back", 150, 600,
    {15, 20, 25, 20, 15, 10, 15, 20, 25, 30, 150, 150, 150, 150}
  },
  
  // Escenario 4: Inclinado a la derecha
  {
    "Leaning Right",
    true, true, "alert", 25.0f, "neutral", 700, 150,
    {150, 140, 80, 60, 40, 30, 150, 140, 40, 30, 40, 35, 40, 35}
  },
  
  // Escenario 5: Inclinado a la izquierda
  {
    "Leaning Left",
    true, true, "alert", -25.0f, "neutral", 700, 150,
    {30, 40, 80, 60, 140, 150, 30, 40, 140, 150, 40, 35, 40, 35}
  },
  
  // Escenario 6: Sentado en el borde
  {
    "Sitting on Edge",
    true, true, "alert", 0.0f, "leaning_forward_or_on_edge", 600, 20,
    {150, 140, 120, 110, 80, 0, 0, 0, 0, 0, 5, 5, 5, 5}
  },
  
  // Escenario 7: Postura normal con ligera variación
  {
    "Good Posture - Slight Shift",
    true, false, "ok", -5.0f, "neutral", 820, 180,
    {85, 80, 95, 90, 90, 85, 75, 85, 80, 75, 45, 45, 45, 45}
  }
};

const int NUM_SCENARIOS = sizeof(scenarios) / sizeof(scenarios[0]);

void sendTestNotification(int scenarioIndex) {
  if (scenarioIndex < 0 || scenarioIndex >= NUM_SCENARIOS) {
    Serial.println("Invalid scenario index");
    return;
  }

  TestScenario& scene = scenarios[scenarioIndex];
  unsigned long ts = millis();

  // Build JSON payload
  String payload = "{";
  payload += "\"ts\":" + String(ts);
  payload += ",\"alert\":" + String(scene.alert ? "true" : "false");
  payload += ",\"status\":\"" + scene.status + "\"";
  payload += ",\"angle\":" + String(scene.angle, 1);
  payload += ",\"zoneAlert\":" + String((scene.zoneStatus != "neutral" && scene.zoneStatus != "empty") ? "true" : "false");
  payload += ",\"zoneStatus\":\"" + scene.zoneStatus + "\"";
  payload += ",\"occupied\":" + String(scene.occupied ? "true" : "false");
  payload += ",\"maxIndex\":0";
  payload += ",\"maxValue\":0";
  payload += ",\"seatSum\":" + String(scene.seatSum);
  payload += ",\"backSum\":" + String(scene.backSum);
  payload += ",\"seatMaxIndex\":0";
  payload += ",\"seatMaxValue\":0";
  payload += ",\"backMaxIndex\":0";
  payload += ",\"backMaxValue\":0";
  
  payload += ",\"values\":[";
  for (int i = 0; i < NUM_SENSORS; ++i) {
    payload += String(scene.values[i]);
    if (i < NUM_SENSORS - 1) payload += ",";
  }
  payload += "]}";

  // Log to Serial
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.printf("║  SCENARIO %d: %s\n", scenarioIndex, scene.name.c_str());
  Serial.println("╚════════════════════════════════════════╝");
  Serial.print("Status: ");
  Serial.println(scene.status);
  Serial.print("Alert: ");
  Serial.println(scene.alert ? "true" : "false");
  Serial.print("ZoneStatus: ");
  Serial.println(scene.zoneStatus);
  Serial.println("Payload size: " + String(payload.length()) + " bytes");
  Serial.println("Sending...\n");

  // Send via Bluetooth Serial
  if (SerialBT.connected()) {
    SerialBT.println(payload);
    Serial.println("✓ Notification sent via Bluetooth Classic");
  } else {
    Serial.println("✗ No Bluetooth client connected");
  }
}

void processCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  
  Serial.println("CMD received: " + cmd);

  if (cmd == "CALIBRATE") {
    SerialBT.println("{\"cmdAck\":\"CALIBRATE\",\"ok\":true}");
    Serial.println("Calibration acknowledged (test mode)");
    
  } else if (cmd == "CALIBRATE_POSTURE") {
    SerialBT.println("{\"cmdAck\":\"CALIBRATE_POSTURE\",\"ok\":true}");
    Serial.println("Posture calibration acknowledged (test mode)");
    
  } else if (cmd == "START") {
    isRunning = true;
    SerialBT.println("{\"cmdAck\":\"START\",\"ok\":true}");
    Serial.println("Monitoring started");
    
  } else if (cmd == "STOP") {
    isRunning = false;
    SerialBT.println("{\"cmdAck\":\"STOP\",\"ok\":true}");
    Serial.println("Monitoring stopped");
  }
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n");
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║   BACKSAFE ESP32 - BLUETOOTH CLASSIC  ║");
  Serial.println("║   Simulated Posture Notifications     ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println();
  
  // Inicializar Bluetooth Serial
  SerialBT.begin(BT_NAME);  // Bluetooth device name
  Serial.println("✓ Bluetooth Classic initialized");
  Serial.println("✓ Device name: " + String(BT_NAME));
  Serial.println("✓ Waiting for connection...");
  
  Serial.println("\n=== TEST SCENARIOS ===");
  for (int i = 0; i < NUM_SCENARIOS; i++) {
    Serial.printf("%d: %s\n", i, scenarios[i].name.c_str());
  }
  Serial.println("======================\n");
  
  Serial.println("Connect from your Android app to start testing\n");
}

void loop() {
  // Procesar comandos recibidos desde la app
  if (SerialBT.available()) {
    String receivedData = SerialBT.readStringUntil('\n');
    if (receivedData.length() > 0) {
      Serial.println("Data from app: " + receivedData);
      processCommand(receivedData);
    }
  }
  
  // Enviar notificaciones si está conectado y corriendo
  if (isRunning && SerialBT.connected()) {
    if (millis() - lastNotify >= 3000) { // Alterna cada 3 segundos
      lastNotify = millis();
      
      // Envía el escenario actual
      sendTestNotification(testScenario);
      
      // Alterna entre escenario 1 (Good Posture - OK) y 2 (Leaning Forward - ALERT)
      testScenario = (testScenario == 1) ? 2 : 1;
    }
  }
  delay(100);
}