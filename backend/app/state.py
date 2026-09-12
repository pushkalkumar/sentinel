"""Process-wide runtime state (BUILD_PLAN §1.2). Frozen: new fields go through INTEGRATION_NOTES."""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

RING_MAXLEN = 240


@dataclass
class RuntimeState:
    rings: dict[str, deque] = field(default_factory=dict)            # node_id -> deque(maxlen=240) of Reading-like dicts, oldest first (sim order)
    latest: dict[str, dict] = field(default_factory=dict)            # node_id -> latest reading dict
    site_band: dict[int, str | None] = field(default_factory=dict)   # site_id -> current decision-card band key
    pending_all_clear: dict[int, dict] = field(default_factory=dict) # site_id -> {since_ts, alert_id, band_at_alert}
    sim_state: dict | None = None                                    # last SimState pushed by the simulator
    sim_last_push_wall: float = 0.0                                  # time.time() of last sim-state push
    last_eval: dict[str, dict] = field(default_factory=dict)         # node_id -> last NodeEval-like dict (for /explain)

    def ring(self, node_id: str) -> deque:
        ring = self.rings.get(node_id)
        if ring is None:
            ring = deque(maxlen=RING_MAXLEN)
            self.rings[node_id] = ring
        return ring


state = RuntimeState()
