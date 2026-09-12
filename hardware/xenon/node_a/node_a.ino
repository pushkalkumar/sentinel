// Sentinel field node on a Particle Xenon (Device OS 1.5.2, the last Xenon release).
//
// Every 5 s: build a KIND_TELEMETRY SentinelMsg and advertise it as BLE manufacturer
// data. MODE click (or the byte 'b' on USB serial, for bench tests): advertise a
// KIND_BUTTON message (priority 2) for BUTTON_ADV_MS, then fall back to the current
// telemetry advert. RGB LED flashes blue on every send.
//
// No cloud, no mesh, no WiFi: SYSTEM_MODE(MANUAL) and BLE only. In production the
// same 24-byte struct rides on LoRa (spec §3.3); only the radio is swapped.
//
// Build:  particle compile xenon node_a/node_a.ino msg.h --target 1.5.2 --saveTo node_a.bin
// Flash:  particle flash --usb node_a.bin

#include "Particle.h"
#include "msg.h"

SYSTEM_MODE(MANUAL);
SYSTEM_THREAD(ENABLED);

const unsigned long TELEMETRY_MS   = 5000;
const unsigned long BUTTON_ADV_MS  = 2000;   // long enough for a 500 ms scan window to catch it several times
const unsigned long LED_FLASH_MS   = 150;
const uint16_t      ADV_INTERVAL   = 160;    // units of 0.625 ms = 100 ms
const float         BATT_MV_PER_LSB = 1.1224f;   // Particle docs: analogRead(BATT) * 0.0011224 V on Argon/Xenon
const float         FIXED_TEMP_C   = 23.0f;      // Xenon has no user-readable temperature sensor

uint16_t      seq = 0;
uint16_t      button_presses = 0;
uint16_t      next_msg_id = 0;
volatile bool button_pending = false;
unsigned long last_telemetry = 0;
unsigned long button_adv_until = 0;
unsigned long led_off_at = 0;
SentinelMsg   telemetry_msg;

uint16_t new_msg_id() {
  // Random start per boot so a reflash does not replay ids the gateway already saw.
  if (next_msg_id == 0) next_msg_id = (uint16_t)(HAL_RNG_GetRandomNumber() | 1);
  return next_msg_id++;
}

void advertise(const SentinelMsg& msg) {
  uint8_t buf[SENTINEL_ADV_LEN];
  buf[0] = SENTINEL_COMPANY_ID & 0xFF;
  buf[1] = SENTINEL_COMPANY_ID >> 8;
  memcpy(buf + 2, &msg, SENTINEL_MSG_LEN);

  BleAdvertisingData adv;                 // constructor adds the 3-byte flags block
  adv.appendCustomData(buf, sizeof(buf));
  BLE.stopAdvertising();
  BLE.setAdvertisingInterval(ADV_INTERVAL);
  BLE.advertise(&adv);

  RGB.color(0, 0, 255);
  led_off_at = millis() + LED_FLASH_MS;
}

void fill_header(SentinelMsg& msg, uint8_t kind, uint8_t priority) {
  memset(&msg, 0, sizeof(msg));
  msg.msg_id    = new_msg_id();
  msg.origin    = NODE_XENON_A;
  msg.hop_count = 0;
  msg.ttl       = SENTINEL_TTL_DEFAULT;
  msg.priority  = priority;
  msg.kind      = kind;
}

void send_telemetry() {
  fill_header(telemetry_msg, KIND_TELEMETRY, PRIO_TELEMETRY);
  TelemetryPayload p;
  p.seq         = ++seq;
  p.temp_c_x100 = (int16_t)(FIXED_TEMP_C * 100.0f);
  p.batt_mv     = (uint16_t)(analogRead(BATT) * BATT_MV_PER_LSB);
  memcpy(telemetry_msg.payload, &p, sizeof(p));
  advertise(telemetry_msg);
}

void send_button() {
  SentinelMsg msg;
  fill_header(msg, KIND_BUTTON, PRIO_BUTTON);
  ButtonPayload p;
  p.seq       = ++button_presses;
  p.uptime_ms = millis();
  memcpy(msg.payload, &p, sizeof(p));
  advertise(msg);
  button_adv_until = millis() + BUTTON_ADV_MS;
}

// MODE single click. Holding MODE 3 s+ is still owned by Device OS (listening mode).
void on_button(system_event_t event, int clicks) {
  if (clicks == 1) button_pending = true;
}

void setup() {
  Serial.begin(115200);
  System.on(button_click, on_button);
  RGB.control(true);
  RGB.color(0, 0, 0);
  BLE.on();
  send_telemetry();
  last_telemetry = millis();
}

void loop() {
  unsigned long now = millis();

  while (Serial.available()) {
    if (Serial.read() == 'b') button_pending = true;   // bench trigger, same path as MODE
  }

  if (button_pending) {
    button_pending = false;
    send_button();
  }

  if (button_adv_until && (long)(now - button_adv_until) >= 0) {
    button_adv_until = 0;
    advertise(telemetry_msg);           // resume the current reading after the alarm burst
  }

  if (!button_adv_until && now - last_telemetry >= TELEMETRY_MS) {
    last_telemetry = now;
    send_telemetry();
  }

  if (led_off_at && (long)(now - led_off_at) >= 0) {
    led_off_at = 0;
    RGB.color(0, 0, 0);
  }
}
