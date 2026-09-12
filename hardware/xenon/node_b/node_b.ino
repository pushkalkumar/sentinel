// Sentinel gateway on a Particle Xenon (Device OS 1.5.2, the last Xenon release).
//
// BLE central: scans continuously for Sentinel manufacturer data (msg.h), drops
// duplicates by msg_id, rebroadcasts each new message exactly once with hop_count+1
// and ttl-1 (so the hop is visible to any other listener), and prints one JSON line
// per new message on USB serial for the laptop bridge. RGB LED flashes green on receive.
//
// No cloud, no mesh, no WiFi: SYSTEM_MODE(MANUAL) and BLE only.
//
// Build:  particle compile xenon node_b/node_b.ino msg.h --target 1.5.2 --saveTo node_b.bin
// Flash:  particle flash --usb node_b.bin

#include "Particle.h"
#include "msg.h"

SYSTEM_MODE(MANUAL);
SYSTEM_THREAD(ENABLED);

const size_t        SCAN_RESULT_MAX = 20;
const uint16_t      SCAN_TIMEOUT    = 50;     // units of 10 ms = 500 ms per BLE.scan() call
const unsigned long REBROADCAST_MS  = 1000;   // how long the forwarded copy stays on air
const unsigned long LED_FLASH_MS    = 150;
const uint16_t      ADV_INTERVAL    = 160;    // 100 ms
const size_t        SEEN_RING       = 32;

BleScanResult scan_results[SCAN_RESULT_MAX];
uint16_t      seen_ids[SEEN_RING];
size_t        seen_head = 0;
size_t        seen_count = 0;
unsigned long rebroadcast_until = 0;
unsigned long led_off_at = 0;

bool seen(uint16_t id) {
  for (size_t i = 0; i < seen_count; i++) {
    if (seen_ids[i] == id) return true;
  }
  return false;
}

void remember(uint16_t id) {
  seen_ids[seen_head] = id;
  seen_head = (seen_head + 1) % SEEN_RING;
  if (seen_count < SEEN_RING) seen_count++;
}

void rebroadcast(SentinelMsg msg) {
  if (msg.ttl == 0) return;
  msg.hop_count++;
  msg.ttl--;

  uint8_t buf[SENTINEL_ADV_LEN];
  buf[0] = SENTINEL_COMPANY_ID & 0xFF;
  buf[1] = SENTINEL_COMPANY_ID >> 8;
  memcpy(buf + 2, &msg, SENTINEL_MSG_LEN);

  BleAdvertisingData adv;
  adv.appendCustomData(buf, sizeof(buf));
  BLE.stopAdvertising();
  BLE.setAdvertisingInterval(ADV_INTERVAL);
  BLE.advertise(&adv);
  rebroadcast_until = millis() + REBROADCAST_MS;
}

// Prints the message as forwarded (hop_count/ttl after this node), which is what the
// backend logs as the xenon-a -> xenon-b hop.
void print_json(const SentinelMsg& msg, int8_t rssi) {
  const char* origin = sentinel_node_name(msg.origin);
  if (msg.kind == KIND_TELEMETRY) {
    TelemetryPayload p;
    memcpy(&p, msg.payload, sizeof(p));
    int t = p.temp_c_x100;
    Serial.printlnf("{\"node\":\"%s\",\"seq\":%u,\"temp_c\":%d.%d,\"batt_mv\":%u,\"rssi\":%d,"
                    "\"msg_id\":\"m-%04x\",\"hop_count\":%u,\"ttl\":%u}",
                    origin, p.seq, t / 100, (abs(t) % 100) / 10, p.batt_mv, rssi,
                    msg.msg_id, msg.hop_count + 1, msg.ttl ? msg.ttl - 1 : 0);
  } else if (msg.kind == KIND_BUTTON) {
    ButtonPayload p;
    memcpy(&p, msg.payload, sizeof(p));
    Serial.printlnf("{\"kind\":\"button\",\"msg_id\":\"m-%04x\",\"origin\":\"%s\",\"press\":%u,"
                    "\"hop_count\":%u,\"ttl\":%u,\"priority\":%u,\"rssi\":%d}",
                    msg.msg_id, origin, p.seq, msg.hop_count + 1, msg.ttl ? msg.ttl - 1 : 0,
                    msg.priority, rssi);
  }
}

void handle(const SentinelMsg& msg, int8_t rssi) {
  if (msg.origin != NODE_XENON_A && msg.origin != NODE_XENON_B) return;
  if (msg.kind != KIND_TELEMETRY && msg.kind != KIND_BUTTON) return;
  if (seen(msg.msg_id)) return;
  remember(msg.msg_id);

  RGB.color(0, 255, 0);
  led_off_at = millis() + LED_FLASH_MS;

  print_json(msg, rssi);
  rebroadcast(msg);
}

void setup() {
  Serial.begin(115200);
  RGB.control(true);
  RGB.color(0, 0, 0);
  BLE.on();
  BLE.setScanTimeout(SCAN_TIMEOUT);
  waitFor(Serial.isConnected, 3000);
  Serial.println("{\"kind\":\"boot\",\"node\":\"xenon-b\",\"fw\":\"xenon-ble-0.1\",\"os\":\"1.5.2\"}");
}

void loop() {
  int count = BLE.scan(scan_results, SCAN_RESULT_MAX);
  for (int i = 0; i < count; i++) {
    uint8_t buf[BLE_MAX_ADV_DATA_LEN];
    size_t len = scan_results[i].advertisingData.get(
        BleAdvertisingDataType::MANUFACTURER_SPECIFIC_DATA, buf, sizeof(buf));
    if (len != SENTINEL_ADV_LEN) continue;
    uint16_t company = buf[0] | (buf[1] << 8);
    if (company != SENTINEL_COMPANY_ID) continue;
    SentinelMsg msg;
    memcpy(&msg, buf + 2, SENTINEL_MSG_LEN);
    handle(msg, scan_results[i].rssi);
  }

  unsigned long now = millis();
  if (rebroadcast_until && (long)(now - rebroadcast_until) >= 0) {
    rebroadcast_until = 0;
    BLE.stopAdvertising();
  }
  if (led_off_at && (long)(now - led_off_at) >= 0) {
    led_off_at = 0;
    RGB.color(0, 0, 0);
  }
}
