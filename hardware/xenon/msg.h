// Sentinel mesh message, on-air layout shared by node_a and node_b (spec §3.3).
//
// 24 bytes packed. Carried as BLE manufacturer-specific data behind a 2-byte
// company id (0xFFFF, the test/private id), so the AD structure is 28 bytes and
// with the mandatory 3-byte flags block the advertisement is exactly 31 bytes.
// There is no room for anything else; do not grow this struct.
#pragma once
#include <stdint.h>

#define SENTINEL_COMPANY_ID   0xFFFF
#define SENTINEL_MSG_LEN      24
#define SENTINEL_ADV_LEN      (2 + SENTINEL_MSG_LEN)
#define SENTINEL_TTL_DEFAULT  8

enum SentinelKind : uint8_t {
  KIND_TELEMETRY = 0,
  KIND_BUTTON    = 1,
};

enum SentinelNode : uint8_t {
  NODE_XENON_A = 1,
  NODE_XENON_B = 2,
};

// priority: 0 = routine telemetry, 2 = human-triggered alarm (backend treats <= 2 as alert priority)
enum SentinelPriority : uint8_t {
  PRIO_TELEMETRY = 0,
  PRIO_BUTTON    = 2,
};

struct __attribute__((packed)) SentinelMsg {
  uint16_t msg_id;      // unique per message; printed as "m-%04x"
  uint8_t  origin;      // SentinelNode
  uint8_t  hop_count;   // incremented by every rebroadcaster
  uint8_t  ttl;         // decremented by every rebroadcaster; 0 = do not forward
  uint8_t  priority;    // SentinelPriority
  uint8_t  kind;        // SentinelKind
  uint8_t  payload[17]; // kind-specific, zero-filled
};
static_assert(sizeof(SentinelMsg) == SENTINEL_MSG_LEN, "SentinelMsg must be 24 bytes");

// KIND_TELEMETRY payload
struct __attribute__((packed)) TelemetryPayload {
  uint16_t seq;
  int16_t  temp_c_x100;  // 2345 = 23.45 C
  uint16_t batt_mv;
};
static_assert(sizeof(TelemetryPayload) <= sizeof(((SentinelMsg*)0)->payload), "payload overflow");

// KIND_BUTTON payload
struct __attribute__((packed)) ButtonPayload {
  uint16_t seq;          // press count since boot
  uint32_t uptime_ms;
};
static_assert(sizeof(ButtonPayload) <= sizeof(((SentinelMsg*)0)->payload), "payload overflow");

static inline const char* sentinel_node_name(uint8_t origin) {
  switch (origin) {
    case NODE_XENON_A: return "xenon-a";
    case NODE_XENON_B: return "xenon-b";
    default:           return "unknown";
  }
}
