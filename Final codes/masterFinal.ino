#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <time.h>

// ---------------- LoRa ----------------
#define LORA_SS   5
#define LORA_RST  14
#define LORA_DIO0 2
#define LORA_FREQ 433E6

const char* POLL_MSG = "S1?";
unsigned long lastSend = 0;
const unsigned long POLL_INTERVAL_MS = 10000; // ✅ 10 seconds

// ---------------- Decision ----------------
const float FREE_THRESHOLD_CM = 50.0;

// ---------------- WiFi ----------------
const char* ssid     = "PIXELTNB";
const char* password = "HANSTHILI";

// ---------------- MQTT ----------------
const char* mqtt_server = "136.112.175.183";
const int   mqtt_port   = 1883;
const char* mqtt_user   = "parking_admin";
const char* mqtt_pass   = "Password123";

WiFiClient espClient;
PubSubClient client(espClient);

// ---------------- Slot / Telemetry ----------------
int slot_id         = 5;
String slot_status  = "unknown";
int battery_mv      = 3710;
int battery_percent = 82;

// ---------------- NTP ----------------
const char* ntpServer          = "pool.ntp.org";
const long  gmtOffset_sec      = 0;
const int   daylightOffset_sec = 0;

// ---- receive buffer from ISR/callback ----
volatile bool gotPacket = false;
String rxMsg;
int rxRSSI = 0;
float rxSNR = 0;

void setup_wifi() {
  delay(10);
  Serial.println("Connecting to WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void setupTime() {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.print("Syncing time");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nTime synced");
}

String getTimeOnly() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "";
  char buf[9];
  strftime(buf, sizeof(buf), "%H:%M:%S", &timeinfo);
  return String(buf);
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "ESP32_Slot_" + String(slot_id);
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("connected!");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 2s...");
      delay(2000);
    }
  }
}

bool parseDistanceCm(const String& s, float &outCm) {
  String t = s;
  t.trim();
  t.toUpperCase();
  if (t == "ERR") return false;

  if (t.length() == 0) return false;
  char c0 = t[0];
  if (!(isDigit(c0) || c0 == '-' || c0 == '.')) return false;

  outCm = t.toFloat();
  return (outCm >= 0);
}

String decideStatus(float cm) {
  return (cm > FREE_THRESHOLD_CM) ? "free" : "occupied";
}

void publishTelemetry(const String& rawReply, bool valid, float cm, int lora_rssi, float lora_snr) {
  String timestamp = getTimeOnly();
  String topic = "parking/slot/" + String(slot_id) + "/telemetry";

  slot_status = valid ? decideStatus(cm) : "unknown";

  String payload = "{";
  payload += "\"slot_id\":" + String(slot_id);
  payload += ",\"status\":\"" + slot_status + "\"";
  payload += ",\"distance_cm\":" + (valid ? String(cm, 1) : "null");
  payload += ",\"distance_valid\":" + String(valid ? "true" : "false");
  payload += ",\"battery_mv\":" + String(battery_mv);
  payload += ",\"battery_percent\":" + String(battery_percent);
  payload += ",\"rssi_dbm\":" + String(lora_rssi);
  payload += ",\"snr_db\":" + String(lora_snr, 2);
  payload += ",\"timestamp\":\"" + timestamp + "\"";
  payload += ",\"raw\":\"" + rawReply + "\"";
  payload += "}";

  client.publish(topic.c_str(), payload.c_str());

  Serial.print("✅ MQTT Published: ");
  Serial.println(payload);
}

// called when ANY LoRa packet arrives (poll reply OR unsolicited push)
void onReceive(int packetSize) {
  if (packetSize <= 0) return;

  String incoming;
  while (LoRa.available()) incoming += (char)LoRa.read();
  incoming.trim();

  rxMsg  = incoming;
  rxRSSI = LoRa.packetRssi();
  rxSNR  = LoRa.packetSnr();
  gotPacket = true;
}

void sendPoll() {
  Serial.println("-> Master polling: S1?");

  LoRa.idle();
  LoRa.beginPacket();
  LoRa.print(POLL_MSG);
  LoRa.endPacket();
  LoRa.receive(); // ✅ go back to RX mode so we can catch pushes
}

void setup() {
  Serial.begin(9600);
  delay(1500);

  Serial.println("\n=== ESP32 Master: Poll every 10s + Push receive ===");

  setup_wifi();
  setupTime();
  client.setServer(mqtt_server, mqtt_port);
  client.setBufferSize(512);

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  Serial.println("LoRa init...");
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init FAILED");
    while (true) delay(1000);
  }
  LoRa.setSyncWord(0x34);
  LoRa.enableCrc();
  LoRa.setTxPower(14);

  LoRa.onReceive(onReceive);
  LoRa.receive(); // ✅ always listening

  Serial.println("LoRa init OK.");
}

void loop() {
  if (!client.connected()) reconnectMQTT();
  client.loop();

  // If any packet arrives, upload immediately
  if (gotPacket) {
    gotPacket = false;

    float cm = 0;
    bool ok = parseDistanceCm(rxMsg, cm);

    Serial.print("<- RX: ");
    Serial.print(rxMsg);
    Serial.print(" RSSI=");
    Serial.print(rxRSSI);
    Serial.print(" SNR=");
    Serial.println(rxSNR);

    publishTelemetry(rxMsg, ok, cm, rxRSSI, rxSNR);
  }

  // Poll every 10 seconds
  if (millis() - lastSend >= POLL_INTERVAL_MS) {
    lastSend = millis();
    sendPoll();
  }
}
