import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for p in (ROOT / "simulator", ROOT / "backend"):   # world/clock, and the backend engine for the replay test
    sys.path.insert(0, str(p))
