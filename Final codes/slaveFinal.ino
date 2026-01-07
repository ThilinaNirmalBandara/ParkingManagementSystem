#include <SPI.h>
#include <LoRa.h>

#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  2
#define LORA_FREQ  433E6

#define TRIG_PIN   12
#define ECHO_PIN   13

const float FREE_THRESHOLD_CM = 50.0;

// measure + push config
const unsigned long MEASURE_INTERVAL_MS = 300;   // sensor check speed
const unsigned long MIN_PUSH_GAP_MS     = 2000;  // prevent spam
unsigned long lastMeasure = 0;
unsigned long lastPush    = 0;

String lastStatus = "unknown"; // "free"/"occupied"/"unknown"

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1.0;
  return (duration * 0.0343) / 2.0;
}

String decideStatus(float cm) {
  if (cm < 0) return "unknown";
  return (cm > FREE_THRESHOLD_CM) ? "free" : "occupied";
}

void sendDistance(float cm) {
  String msg = (cm < 0) ? "ERR" : String(cm, 1);
  LoRa.beginPacket();
  LoRa.print(msg);
  LoRa.endPacket();

  Serial.print("-> Slave sent: ");
  Serial.println(msg);
}

void setup() {
  Serial.begin(9600);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  Serial.println("LoRa init...");
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init FAILED");
    while (true) delay(1000);
  }

  LoRa.setSyncWord(0x34);
  LoRa.enableCrc();
  LoRa.setTxPower(10);

  Serial.println("LoRa init OK. Slave ultrasonic ready.");
}

void loop() {
  // 1) Handle poll requests from master
  int packetSize = LoRa.parsePacket();
  if (packetSize > 0) {
    String incoming;
    while (LoRa.available()) incoming += (char)LoRa.read();
    incoming.trim();

    Serial.print("<- Slave got: ");
    Serial.println(incoming);

    if (incoming == "S1?") {
      float cm = readDistanceCm();
      sendDistance(cm);
    }
  }

  // 2) Push update when status changes (without being asked)
  if (millis() - lastMeasure >= MEASURE_INTERVAL_MS) {
    lastMeasure = millis();

    float cm = readDistanceCm();
    String st = decideStatus(cm);

    if (st != lastStatus) {
      // rate limit pushes
      if (millis() - lastPush >= MIN_PUSH_GAP_MS) {
        lastPush = millis();
        lastStatus = st;

        Serial.print("Status changed => ");
        Serial.println(st);

        sendDistance(cm);   // push the distance (master decides free/occupied)
      }
    }
  }
}
