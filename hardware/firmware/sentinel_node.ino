/*
 * Sentinel Node firmware, rev A
 *
 * Designed, not fabricated. Pin numbers per spec §3.2 (DevKit numbering); S3 remap pending.
 *
 * Target: ESP32 (arduino-esp32 core 3.x). Board: "ESP32S3 Dev Module" once the pin
 * remap lands; today the numbers below are the classic DevKit numbers from spec §3.2
 * and the sketch is reviewed, not flashed.
 *
 * What this node does on its own, with no backend and no neighbours (spec §3.3):
 *   - WiFi access point SENTINEL-<node_id> at 192.168.4.1, open network
 *   - captive DNS answering every hostname with 192.168.4.1
 *   - a 2 KB portal page from flash with the "I'm in danger" report form (POST /report)
 *   - BME280 over I2C every 60 s, PMS5003 over UART2 duty-cycled with SET,
 *     MQ-2 on the ADC with a rolling baseline
 *   - local alert rules (spec §6.2 rate-of-rise and absolute thresholds) driving
 *     the WS2812 LED, the piezo buzzer, the portal banner and a priority mesh message
 *   - SX1262 flooding mesh via RadioLib: {msg_id, origin, hop_count, ttl, priority},
 *     de-dup by msg_id, random back-off, 256-entry store-and-forward ring, 30 s retry
 *   - light sleep between tasks in normal mode; AP beacon-only unless a button press
 *     or a mesh "disaster" flag brings it fully up
 *
 * Libraries (Library Manager): RadioLib, Adafruit BME280, Adafruit NeoPixel.
 * DNSServer, WebServer, WiFi, Wire, HardwareSerial, Preferences ship with the core.
 */

#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <Wire.h>
#include <Preferences.h>
#include <esp_sleep.h>
#include <esp_random.h>
#include <RadioLib.h>
#include <Adafruit_BME280.h>
#include <Adafruit_NeoPixel.h>

// ---------------------------------------------------------------- pin map (spec §3.2)
static const int PIN_PMS_RX   = 16;  // UART2 RX  <- PMS5003 TX
static const int PIN_PMS_TX   = 17;  // UART2 TX  -> PMS5003 RX
static const int PIN_PMS_SET  = 4;   // PMS5003 SET, low = fan off
static const int PIN_I2C_SDA  = 21;  // BME280 SDA
static const int PIN_I2C_SCL  = 22;  // BME280 SCL
static const int PIN_MQ2_ADC  = 34;  // ADC1_CH6, MQ-2 AOUT through 2:1 divider
static const int PIN_LORA_MOSI = 23;
static const int PIN_LORA_MISO = 19;
static const int PIN_LORA_SCK  = 18;
static const int PIN_LORA_NSS  = 5;
static const int PIN_LORA_DIO1 = 26;
static const int PIN_LORA_RST  = 14;
static const int PIN_LORA_BUSY = 27;
static const int PIN_BUTTON   = 0;   // "I'm here", external 10k pull-down, active high
static const int PIN_LED_DIN  = 2;   // WS2812, one pixel, on the switched 5 V rail
static const int PIN_BUZZER   = 25;  // piezo through NPN driver, PWM
static const int PIN_VBAT_ADC = 35;  // battery sense, 2:1 divider
static const int PIN_5V_EN    = 33;  // P-MOSFET gate for 5V_SW (fan + heater rail)

// ---------------------------------------------------------------- timing (spec §3.3, §3.6)
static const uint32_t BME_PERIOD_MS        = 60 * 1000;
static const uint32_t PMS_PERIOD_MS        = 5 * 60 * 1000;   // fan burst every 5 min
static const uint32_t PMS_BURST_MS         = 30 * 1000;       // 30 s per burst
static const uint32_t MQ2_PERIOD_MS        = 10 * 1000;       // sample every 10 s
static const uint32_t MQ2_HEATER_ON_MS     = 10 * 1000;       // 10 s per 60 s duty
static const uint32_t MQ2_HEATER_PERIOD_MS = 60 * 1000;
static const uint32_t MQ2_WARMUP_MS        = 20 * 1000;       // spec §3.2: 20 s warm-up
static const uint32_t TELEMETRY_NORMAL_MS  = 5 * 60 * 1000;
static const uint32_t TELEMETRY_ALERT_MS   = 30 * 1000;
static const uint32_t MESH_RETRY_MS        = 30 * 1000;
static const uint32_t BUTTON_DEBOUNCE_MS   = 40;
static const uint32_t LIGHT_SLEEP_SLICE_MS = 2000;

// ---------------------------------------------------------------- alert thresholds (spec §6.2)
// The spatial check (r.pm25 > 2 * regional) needs neighbours; on the node we use the
// last regional median received over the mesh, and skip the test when none is known.
static const float PM_RISE_5MIN_UGM3   = 40.0f;   // pm_rise > 40 over 5 min
static const float TEMP_RISE_2MIN_C    = 3.0f;    // temp_rise > 3 over 2 min
static const float GAS_DELTA_THRESHOLD = 300.0f;  // ADC counts over the rolling baseline
static const float PM_HAZARDOUS_UGM3   = 225.5f;  // spec §6.1 Hazardous band
static const float REGIONAL_HAZARD_UGM3 = 150.0f;

enum AlertLevel : uint8_t {
  ALERT_NONE = 0,
  ALERT_ACTIVITY_ADVISORY = 4,   // priority 4
  ALERT_LOCAL_SMOKE_SUSPECT = 3, // priority 3
  ALERT_HAZARDOUS_SMOKE = 2,     // priority 2
  ALERT_LOCAL_FIRE = 1           // priority 1
};

// ---------------------------------------------------------------- mesh message (spec §3.3)
// Compact binary, ~24 bytes for a telemetry reading. Same design family as Meshtastic:
// flooding with de-dup, no routing table.
enum MsgKind : uint8_t { MSG_TELEMETRY = 1, MSG_ALERT = 2, MSG_REPORT = 3, MSG_DISASTER = 4 };

struct __attribute__((packed)) MeshHeader {
  uint32_t msg_id;     // origin id << 16 | sequence, unique per origin
  uint16_t origin;     // node id that created the message
  uint8_t  hop_count;  // incremented on every rebroadcast
  uint8_t  ttl;        // default 8, drop at 0
  uint8_t  priority;   // 1 = LOCAL_FIRE ... 4 = advisory, 5 = telemetry
  uint8_t  kind;       // MsgKind
};

struct __attribute__((packed)) TelemetryPayload {
  uint16_t pm25_x10;
  uint16_t pm10_x10;
  int16_t  temp_x100;
  uint16_t rh_x100;
  uint16_t mq2_raw;
  uint16_t vbat_mv;
  uint8_t  alert;
  uint8_t  flags;      // bit0 disaster, bit1 button pressed since last report
};

struct __attribute__((packed)) MeshPacket {
  MeshHeader hdr;
  uint8_t    len;
  uint8_t    body[40];
};

static const size_t   QUEUE_SIZE  = 256;   // store-and-forward ring, spec §3.3
static const size_t   SEEN_SIZE   = 256;   // de-dup memory
static const uint8_t  DEFAULT_TTL = 8;

// ---------------------------------------------------------------- state
struct NodeState {
  uint16_t node_id = 0;
  bool     disaster_mode = false;
  bool     ap_full = false;
  AlertLevel alert = ALERT_NONE;
  // sensors
  float temp_c = NAN, rh = NAN, pressure_hpa = NAN;
  float pm1 = NAN, pm25 = NAN, pm10 = NAN;
  uint16_t mq2_raw = 0;
  float    mq2_baseline = 0;     // slow rolling baseline, spec §6.2 gas_delta
  uint16_t vbat_mv = 0;
  float    regional_pm25 = NAN;  // last median heard from neighbours over the mesh
  // history for rate-of-rise
  float pm25_hist[30];   // 10 s samples, 5 min
  float temp_hist[12];   // 10 s samples, 2 min
  uint8_t pm25_idx = 0, temp_idx = 0;
  bool    hist_full = false;
  bool    button_since_report = false;
} st;

Preferences prefs;
DNSServer dns;
WebServer web(80);
HardwareSerial pmsSerial(2);
Adafruit_BME280 bme;
Adafruit_NeoPixel led(1, PIN_LED_DIN, NEO_GRB + NEO_KHZ800);
SX1262 radio = new Module(PIN_LORA_NSS, PIN_LORA_DIO1, PIN_LORA_RST, PIN_LORA_BUSY);

static const IPAddress AP_IP(192, 168, 4, 1);
static const IPAddress AP_MASK(255, 255, 255, 0);

// Forward declarations (the Arduino preprocessor does not always generate these for statics).
struct MeshPacket;
static void mesh_send(const MeshPacket& p);
static void enter_disaster_mode(bool on);
static void ap_start(bool full);
static bool mq2_heater_on();
static void send_telemetry();

// ---------------------------------------------------------------- store-and-forward ring
struct MeshQueue {
  MeshPacket ring[QUEUE_SIZE];
  uint32_t   sent_at[QUEUE_SIZE];
  bool       used[QUEUE_SIZE];
  size_t     head = 0;

  void push(const MeshPacket& p) {
    // Overwrite the oldest slot; a 256-deep ring outlives any realistic outage
    // and still bounds RAM at ~13 KB.
    ring[head] = p;
    sent_at[head] = 0;
    used[head] = true;
    head = (head + 1) % QUEUE_SIZE;
  }
  void ack(uint32_t msg_id) {
    for (size_t i = 0; i < QUEUE_SIZE; i++)
      if (used[i] && ring[i].hdr.msg_id == msg_id) used[i] = false;
  }
} queue;

struct SeenSet {
  uint32_t ids[SEEN_SIZE];
  size_t   head = 0;
  bool has(uint32_t id) const {
    for (size_t i = 0; i < SEEN_SIZE; i++) if (ids[i] == id) return true;
    return false;
  }
  void add(uint32_t id) { ids[head] = id; head = (head + 1) % SEEN_SIZE; }
} seen;

static uint16_t seq_counter = 0;
static uint32_t next_msg_id() { return ((uint32_t)st.node_id << 16) | (++seq_counter); }

// ---------------------------------------------------------------- portal page (spec §8.2)
// Under 2 KB, no external assets. Served from flash for every request the captive DNS
// redirects here. In production the phone app is the full ~60 KB bundle; this is the
// minimum that still lets a stranger's phone file a verified report.
static const char PORTAL_HTML[] PROGMEM = R"HTML(<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sentinel</title>
<style>body{font:16px system-ui;margin:0;padding:20px;background:#F7F4EF;color:#141210}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#5C5750}
label{display:block;margin:12px 0 4px}select,textarea,input{width:100%;font:inherit;padding:12px;border:1px solid #C9C3BA;border-radius:6px;box-sizing:border-box}
button{width:100%;margin-top:16px;padding:14px;font:inherit;font-weight:600;background:#06272D;color:#fff;border:0;border-radius:6px}
.b{padding:12px;border-radius:6px;margin-bottom:16px;background:#FFE8E5;color:#8A1F14;display:none}
.code{font:600 28px ui-monospace,monospace;letter-spacing:.08em}</style></head><body>
<div id="al" class="b">Local alarm active at this node.</div>
<h1>Sentinel node %NODE%</h1><p>No internet needed. This page is served by the box you are standing next to.</p>
<form method="post" action="/report"><label>What is happening</label>
<select name="type"><option value="fire">Fire</option><option value="smoke">Smoke</option><option value="injury">Injury</option><option value="trapped">Trapped</option><option value="other">Other</option></select>
<label>People affected</label><input name="count" type="number" min="0" value="1">
<label>Details (optional)</label><textarea name="text" rows="3"></textarea>
<input type="hidden" name="lat" id="lat"><input type="hidden" name="lon" id="lon">
<button>Send report</button></form>
<script>if(navigator.geolocation)navigator.geolocation.getCurrentPosition(function(p){lat.value=p.coords.latitude;lon.value=p.coords.longitude},function(){},{timeout:4000});
if(%ALERT%)document.getElementById('al').style.display='block'</script></body></html>)HTML";

static const char REPORT_OK_HTML[] PROGMEM = R"HTML(<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sentinel</title>
<style>body{font:16px system-ui;margin:0;padding:20px;background:#F7F4EF;color:#141210}
.code{font:600 32px ui-monospace,monospace;letter-spacing:.08em;margin:12px 0}</style></head><body>
<h1>Report queued</h1><p>Your incident code. Write it on your hand.</p><div class="code">%CODE%</div>
<p>It leaves this box over radio as soon as a neighbour hears it. Responders see it when any node reaches the network.</p>
</body></html>)HTML";

// Incident codes are SN-XXXX. The node mints a provisional one from its id and a
// counter; the backend keeps it if unused, otherwise reissues and tells the reporter
// on their next status check.
static String make_incident_code() {
  static uint16_t n = 0;
  n++;
  char buf[8];
  uint16_t v = (st.node_id * 131 + n) % 10000;
  snprintf(buf, sizeof(buf), "SN-%04u", v);
  return String(buf);
}

// ---------------------------------------------------------------- web handlers
static void handle_root() {
  String page = FPSTR(PORTAL_HTML);
  page.replace("%NODE%", String(st.node_id));
  page.replace("%ALERT%", st.alert == ALERT_LOCAL_FIRE ? "true" : "false");
  web.send(200, "text/html", page);
}

static void handle_report() {
  String type = web.arg("type");
  String text = web.arg("text");
  int count = web.arg("count").toInt();
  float lat = web.arg("lat").toFloat();
  float lon = web.arg("lon").toFloat();

  // Proximity is the verification (spec §7.2): the phone is on this node's AP, so the
  // report carries this node id, not a self-declared location.
  MeshPacket p = {};
  p.hdr.msg_id = next_msg_id();
  p.hdr.origin = st.node_id;
  p.hdr.hop_count = 0;
  p.hdr.ttl = DEFAULT_TTL;
  p.hdr.priority = 1;
  p.hdr.kind = MSG_REPORT;
  String code = make_incident_code();
  // body: code(7) type(1) count(1) lat(4) lon(4) text(up to 23)
  size_t i = 0;
  memcpy(p.body + i, code.c_str(), 7); i += 7;
  p.body[i++] = (uint8_t)(type == "fire" ? 1 : type == "smoke" ? 2 : type == "injury" ? 3 : type == "trapped" ? 4 : 0);
  p.body[i++] = (uint8_t)constrain(count, 0, 255);
  memcpy(p.body + i, &lat, 4); i += 4;
  memcpy(p.body + i, &lon, 4); i += 4;
  size_t tl = min((size_t)text.length(), sizeof(p.body) - i);
  memcpy(p.body + i, text.c_str(), tl); i += tl;
  p.len = (uint8_t)i;
  queue.push(p);
  seen.add(p.hdr.msg_id);
  mesh_send(p);

  // A report from a phone standing next to the box is the mesh "disaster" flag for
  // this node: the AP stays fully up until an admin clears it (spec §3.3 sleep rule).
  enter_disaster_mode(true);

  String page = FPSTR(REPORT_OK_HTML);
  page.replace("%CODE%", code);
  web.send(200, "text/html", page);
}

// Every other URL (Apple, Android and Windows connectivity probes included) gets a
// redirect to the portal, which is what makes the "sign in to network" sheet pop up.
static void handle_not_found() {
  web.sendHeader("Location", String("http://") + AP_IP.toString() + "/", true);
  web.send(302, "text/plain", "");
}

// ---------------------------------------------------------------- WiFi AP (spec §2.1, §3.3)
static void ap_start(bool full) {
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_IP, AP_MASK);
  String ssid = "SENTINEL-" + String(st.node_id);
  // Open network on purpose: a stranger's phone must be able to join with no password.
  WiFi.softAP(ssid.c_str(), nullptr, 1, 0, 4);
  // Normal mode keeps the beacon so the SSID is discoverable but sleeps the modem
  // between beacons. Disaster mode disables modem sleep so the portal answers fast.
  WiFi.setSleep(!full);
  st.ap_full = full;
  dns.setErrorReplyCode(DNSReplyCode::NoError);
  dns.start(53, "*", AP_IP);   // wildcard: every hostname resolves to 192.168.4.1
}

static void enter_disaster_mode(bool on) {
  if (st.disaster_mode == on) return;
  st.disaster_mode = on;
  if (on && !st.ap_full) ap_start(true);
  if (on) { digitalWrite(PIN_5V_EN, HIGH); digitalWrite(PIN_PMS_SET, HIGH); }  // sensors continuous
}

// ---------------------------------------------------------------- sensors
static void bme_read() {
  st.temp_c = bme.readTemperature();
  st.rh = bme.readHumidity();
  st.pressure_hpa = bme.readPressure() / 100.0f;
}

// PMS5003 frame: 0x42 0x4D, length, 13 x uint16, checksum. We take the "atmospheric"
// values (fields 4..6), not the CF=1 ones.
static bool pms_read_frame() {
  while (pmsSerial.available() >= 32) {
    if (pmsSerial.peek() != 0x42) { pmsSerial.read(); continue; }
    uint8_t buf[32];
    if (pmsSerial.readBytes(buf, 32) != 32) return false;
    if (buf[1] != 0x4D) continue;
    uint16_t sum = 0;
    for (int i = 0; i < 30; i++) sum += buf[i];
    uint16_t chk = (buf[30] << 8) | buf[31];
    if (sum != chk) continue;
    st.pm1  = (buf[10] << 8) | buf[11];
    st.pm25 = (buf[12] << 8) | buf[13];
    st.pm10 = (buf[14] << 8) | buf[15];
    return true;
  }
  return false;
}

// Fan duty cycle via SET (spec §3.3): 30 s on every 5 min in normal mode, continuous
// when any alert level is active or in disaster mode. The first ~10 s after wake are
// discarded by the PMS itself; we simply read the last good frame of the burst.
static void pms_service(uint32_t now) {
  static uint32_t burst_start = 0;
  static bool fan_on = false;
  bool want_continuous = st.disaster_mode || st.alert != ALERT_NONE;

  if (want_continuous) {
    if (!fan_on) { digitalWrite(PIN_5V_EN, HIGH); digitalWrite(PIN_PMS_SET, HIGH); fan_on = true; }
    pms_read_frame();
    return;
  }
  if (!fan_on && now - burst_start >= PMS_PERIOD_MS) {
    digitalWrite(PIN_5V_EN, HIGH);
    digitalWrite(PIN_PMS_SET, HIGH);
    fan_on = true;
    burst_start = now;
  } else if (fan_on && now - burst_start >= PMS_BURST_MS) {
    pms_read_frame();
    digitalWrite(PIN_PMS_SET, LOW);
    fan_on = false;
    if (!mq2_heater_on()) digitalWrite(PIN_5V_EN, LOW);  // cut the 5 V rail when nobody needs it
  } else if (fan_on) {
    pms_read_frame();
  }
}

// MQ-2 heater shares the switched 5 V rail. 10 s on per 60 s in normal mode
// (~25 mA averaged, spec §3.6); the reading is taken at the end of the on window
// because the spec's 20 s warm-up is only met in continuous mode. Outdoor-only nodes
// can drop the MQ-2 entirely (spec §3.6) by setting MQ2_PRESENT to false.
static const bool MQ2_PRESENT = true;
static uint32_t mq2_heater_since = 0;
static bool mq2_heater_on() {
  if (!MQ2_PRESENT) return false;
  if (st.disaster_mode || st.alert != ALERT_NONE) return true;
  uint32_t phase = millis() % MQ2_HEATER_PERIOD_MS;
  return phase < MQ2_HEATER_ON_MS;
}

static void mq2_service(uint32_t now) {
  static uint32_t last_sample = 0;
  if (!MQ2_PRESENT) return;
  bool on = mq2_heater_on();
  if (on && mq2_heater_since == 0) { digitalWrite(PIN_5V_EN, HIGH); mq2_heater_since = now; }
  if (!on) mq2_heater_since = 0;
  if (now - last_sample < MQ2_PERIOD_MS) return;
  last_sample = now;
  if (!on) return;
  // In continuous mode wait for the full warm-up before trusting the reading.
  bool warm = (now - mq2_heater_since) >= (st.disaster_mode ? MQ2_WARMUP_MS : MQ2_HEATER_ON_MS - 1000);
  if (!warm) return;
  uint16_t raw = analogRead(PIN_MQ2_ADC);   // 12-bit, through 2:1 divider
  st.mq2_raw = raw;
  // Slow baseline (time constant ~1 h at one sample per 10 s) so drift does not alarm.
  if (st.mq2_baseline == 0) st.mq2_baseline = raw;
  else st.mq2_baseline += (raw - st.mq2_baseline) / 360.0f;
}

static void vbat_read() {
  uint32_t mv = analogReadMilliVolts(PIN_VBAT_ADC);
  st.vbat_mv = (uint16_t)(mv * 2);   // 2:1 divider
}

// ---------------------------------------------------------------- local rule engine (spec §6.2)
static void push_history() {
  st.pm25_hist[st.pm25_idx] = isnan(st.pm25) ? 0 : st.pm25;
  st.temp_hist[st.temp_idx] = isnan(st.temp_c) ? 0 : st.temp_c;
  st.pm25_idx = (st.pm25_idx + 1) % 30;
  st.temp_idx = (st.temp_idx + 1) % 12;
  if (st.pm25_idx == 0) st.hist_full = true;
}

static AlertLevel evaluate_rules() {
  if (!st.hist_full || isnan(st.pm25)) return st.alert;   // not enough history yet
  float pm_5min_ago = st.pm25_hist[st.pm25_idx];          // oldest slot
  float temp_2min_ago = st.temp_hist[st.temp_idx];
  float pm_rise = st.pm25 - pm_5min_ago;
  float temp_rise = st.temp_c - temp_2min_ago;
  float gas_delta = (float)st.mq2_raw - st.mq2_baseline;
  // With no neighbour data the spatial test is skipped, which makes the node more
  // sensitive, not less. The backend re-evaluates with the real regional median.
  bool spatial = isnan(st.regional_pm25) || st.pm25 > 2.0f * st.regional_pm25;

  if (pm_rise > PM_RISE_5MIN_UGM3 && (temp_rise > TEMP_RISE_2MIN_C || gas_delta > GAS_DELTA_THRESHOLD) && spatial)
    return ALERT_LOCAL_FIRE;
  if (st.pm25 > PM_HAZARDOUS_UGM3 && (!isnan(st.regional_pm25) && st.regional_pm25 > REGIONAL_HAZARD_UGM3))
    return ALERT_HAZARDOUS_SMOKE;
  if (pm_rise > PM_RISE_5MIN_UGM3 && spatial)
    return ALERT_LOCAL_SMOKE_SUSPECT;
  // ACTIVITY_ADVISORY (band worsened) is a backend decision; the node only reports.
  return ALERT_NONE;
}

// ---------------------------------------------------------------- LED + buzzer
static void led_set(uint8_t r, uint8_t g, uint8_t b) { led.setPixelColor(0, led.Color(r, g, b)); led.show(); }

static void indicate(uint32_t now) {
  // Green, amber, red at a glance (HARDWARE_3D §3). Red plus buzzer is the local alarm.
  switch (st.alert) {
    case ALERT_LOCAL_FIRE: {
      bool phase = (now / 250) % 2;
      led_set(phase ? 255 : 40, 0, 0);
      ledcWriteTone(PIN_BUZZER, phase ? 2800 : 0);
      break;
    }
    case ALERT_HAZARDOUS_SMOKE:
    case ALERT_LOCAL_SMOKE_SUSPECT:
      led_set(255, 120, 0);
      ledcWriteTone(PIN_BUZZER, ((now / 1000) % 10 == 0) ? 2000 : 0);  // one chirp per 10 s
      break;
    default:
      led_set(0, 60, 20);
      ledcWriteTone(PIN_BUZZER, 0);
  }
}

// ---------------------------------------------------------------- mesh (spec §3.3, §5.1)
static volatile bool radio_flag = false;
static void IRAM_ATTR on_radio_dio1() { radio_flag = true; }

static void mesh_send(const MeshPacket& p) {
  size_t n = sizeof(MeshHeader) + 1 + p.len;
  radio.transmit((uint8_t*)&p, n);
  radio.startReceive();
}

static uint32_t backoff_ms(uint8_t priority) {
  // Random back-off 10 to 200 ms, shorter for higher priority (priority 1 wins the channel).
  uint32_t span = 10 + 38 * (priority > 5 ? 5 : priority);   // p1: 48, p5: 200
  return 10 + (esp_random() % span);
}

static void mesh_handle_rx() {
  MeshPacket p = {};
  int state = radio.readData((uint8_t*)&p, sizeof(p));
  radio.startReceive();
  if (state != RADIOLIB_ERR_NONE) return;
  if (seen.has(p.hdr.msg_id)) return;     // de-dup by msg_id
  seen.add(p.hdr.msg_id);

  switch (p.hdr.kind) {
    case MSG_DISASTER: enter_disaster_mode(true); break;
    case MSG_TELEMETRY: {
      // Neighbours' PM2.5 feeds the spatial check. A proper median needs the backend;
      // on the node a 1:3 EMA of what we hear is an honest cheap stand-in.
      if (p.len >= sizeof(TelemetryPayload)) {
        TelemetryPayload t; memcpy(&t, p.body, sizeof(t));
        float v = t.pm25_x10 / 10.0f;
        st.regional_pm25 = isnan(st.regional_pm25) ? v : (st.regional_pm25 * 2 + v) / 3;
      }
      break;
    }
    default: break;
  }

  // Flood: rebroadcast anything unseen with ttl left, after a back-off.
  if (p.hdr.ttl == 0) return;
  p.hdr.ttl--;
  p.hdr.hop_count++;
  delay(backoff_ms(p.hdr.priority));
  mesh_send(p);
}

static void mesh_retry(uint32_t now) {
  // Store-and-forward: anything still in the ring is re-sent every 30 s until a
  // gateway acks it (MSG kind reserved) or it ages out by overwrite.
  for (size_t i = 0; i < QUEUE_SIZE; i++) {
    if (!queue.used[i]) continue;
    if (queue.sent_at[i] != 0 && now - queue.sent_at[i] < MESH_RETRY_MS) continue;
    mesh_send(queue.ring[i]);
    queue.sent_at[i] = now;
  }
}

static void send_telemetry() {
  MeshPacket p = {};
  p.hdr.msg_id = next_msg_id();
  p.hdr.origin = st.node_id;
  p.hdr.ttl = DEFAULT_TTL;
  p.hdr.priority = st.alert == ALERT_NONE ? 5 : st.alert;
  p.hdr.kind = st.alert == ALERT_NONE ? MSG_TELEMETRY : MSG_ALERT;
  TelemetryPayload t = {};
  t.pm25_x10 = isnan(st.pm25) ? 0 : (uint16_t)(st.pm25 * 10);
  t.pm10_x10 = isnan(st.pm10) ? 0 : (uint16_t)(st.pm10 * 10);
  t.temp_x100 = isnan(st.temp_c) ? 0 : (int16_t)(st.temp_c * 100);
  t.rh_x100 = isnan(st.rh) ? 0 : (uint16_t)(st.rh * 100);
  t.mq2_raw = st.mq2_raw;
  t.vbat_mv = st.vbat_mv;
  t.alert = st.alert;
  t.flags = (st.disaster_mode ? 1 : 0) | (st.button_since_report ? 2 : 0);
  memcpy(p.body, &t, sizeof(t));
  p.len = sizeof(t);
  seen.add(p.hdr.msg_id);
  if (st.alert != ALERT_NONE) queue.push(p);   // alerts are store-and-forward; plain telemetry is fire-and-forget
  mesh_send(p);
  st.button_since_report = false;
}

// ---------------------------------------------------------------- button
static void button_service(uint32_t now) {
  static bool last = false;
  static uint32_t changed_at = 0;
  bool raw = digitalRead(PIN_BUTTON) == HIGH;
  if (raw != last) { last = raw; changed_at = now; return; }
  if (raw && now - changed_at == BUTTON_DEBOUNCE_MS) {
    // Muster-point check-in and wake-from-sleep. Pressing it also brings the AP fully up.
    st.button_since_report = true;
    if (!st.ap_full) ap_start(true);
    send_telemetry();
  }
}

// ---------------------------------------------------------------- setup / loop
void setup() {
  Serial.begin(115200);
  prefs.begin("sentinel", false);
  st.node_id = prefs.getUShort("node_id", 0);
  if (st.node_id == 0) {
    // First boot: derive an id from the MAC so unprovisioned nodes still get a unique SSID.
    uint64_t mac = ESP.getEfuseMac();
    st.node_id = (uint16_t)(mac & 0xFFFF);
    prefs.putUShort("node_id", st.node_id);
  }

  pinMode(PIN_5V_EN, OUTPUT);   digitalWrite(PIN_5V_EN, LOW);
  pinMode(PIN_PMS_SET, OUTPUT); digitalWrite(PIN_PMS_SET, LOW);
  pinMode(PIN_BUTTON, INPUT);   // external 10 kΩ pull-down, spec §3.2
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MQ2_ADC, ADC_11db);
  analogSetPinAttenuation(PIN_VBAT_ADC, ADC_11db);

  ledcAttach(PIN_BUZZER, 2000, 8);   // core 3.x LEDC API
  led.begin();
  led_set(0, 0, 40);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  if (!bme.begin(0x76)) Serial.println("BME280 not found at 0x76");
  bme.setSampling(Adafruit_BME280::MODE_FORCED);

  pmsSerial.begin(9600, SERIAL_8N1, PIN_PMS_RX, PIN_PMS_TX);

  SPI.begin(PIN_LORA_SCK, PIN_LORA_MISO, PIN_LORA_MOSI, PIN_LORA_NSS);
  // 915 MHz, BW 125 kHz, SF9, CR 4/7, sync 0x12, +22 dBm (spec §3.7)
  int state = radio.begin(915.0, 125.0, 9, 7, RADIOLIB_SX126X_SYNC_WORD_PRIVATE, 22, 8, 1.6, false);
  if (state != RADIOLIB_ERR_NONE) Serial.printf("SX1262 init failed: %d\n", state);
  radio.setDio1Action(on_radio_dio1);
  radio.startReceive();

  ap_start(false);   // beacon-only until a button press or a disaster flag
  web.on("/", HTTP_GET, handle_root);
  web.on("/report", HTTP_POST, handle_report);
  web.onNotFound(handle_not_found);
  web.begin();

  Serial.printf("Sentinel node %u up, AP SENTINEL-%u at %s\n", st.node_id, st.node_id, AP_IP.toString().c_str());
}

void loop() {
  uint32_t now = millis();
  static uint32_t last_bme = 0, last_rules = 0, last_telemetry = 0, last_vbat = 0;

  dns.processNextRequest();
  web.handleClient();
  button_service(now);

  if (radio_flag) { radio_flag = false; mesh_handle_rx(); }

  if (now - last_bme >= BME_PERIOD_MS || last_bme == 0) { last_bme = now; bme.takeForcedMeasurement(); bme_read(); }
  pms_service(now);
  mq2_service(now);
  if (now - last_vbat >= 60000) { last_vbat = now; vbat_read(); }

  if (now - last_rules >= 10000) {   // rules run on 10 s samples, spec §6.2
    last_rules = now;
    push_history();
    AlertLevel next = evaluate_rules();
    if (next != st.alert) {
      st.alert = next;
      if (next == ALERT_LOCAL_FIRE) {
        // Local alarm: LED red, buzzer, portal banner (handle_root), priority mesh message.
        send_telemetry();
      }
    }
  }

  uint32_t period = (st.alert != ALERT_NONE || st.disaster_mode) ? TELEMETRY_ALERT_MS : TELEMETRY_NORMAL_MS;
  if (now - last_telemetry >= period) { last_telemetry = now; send_telemetry(); }
  mesh_retry(now);
  indicate(now);

  // Light sleep between tasks in normal mode (spec §3.3). The radio DIO1 and the button
  // wake us; the AP beacon keeps running in modem-sleep. Disaster mode never sleeps.
  bool busy = st.disaster_mode || st.alert != ALERT_NONE || st.ap_full || WiFi.softAPgetStationNum() > 0;
  if (!busy) {
    esp_sleep_enable_timer_wakeup((uint64_t)LIGHT_SLEEP_SLICE_MS * 1000ULL);
    esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_BUTTON, 1);
    esp_light_sleep_start();
  } else {
    delay(5);
  }
}
