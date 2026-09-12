# OWNER: backend-alerts
"""PM2.5 bands and the default policy pack (CONTRACT §5.1). DEFAULT_POLICY is verbatim; seed uses it."""
from __future__ import annotations

DEFAULT_POLICY: dict = {
    "bands": [
        {"key": "good", "label": "Good", "max": 9.0, "color": "#4ADE80",
         "headline": "Outdoor practice: OK", "guidance": "Normal"},
        {"key": "moderate", "label": "Moderate", "max": 35.4, "color": "#FACC15",
         "headline": "Outdoor practice: OK", "guidance": "Normal; sensitive students may limit prolonged exertion"},
        {"key": "usg", "label": "Unhealthy for sensitive groups", "max": 55.4, "color": "#FB923C",
         "headline": "Limit outdoor practice to 60 min", "guidance": "Move sensitive groups indoors; limit intense practice to 60 min"},
        {"key": "unhealthy", "label": "Unhealthy", "max": 125.4, "color": "#F87171",
         "headline": "Cancel outdoor practice and recess", "guidance": "Cancel outdoor practice and recess; PE indoors"},
        {"key": "very_unhealthy", "label": "Very unhealthy", "max": 225.4, "color": "#C084FC",
         "headline": "All outdoor activity cancelled", "guidance": "All outdoor activity cancelled; consider dismissal per district policy"},
        {"key": "hazardous", "label": "Hazardous", "max": None, "color": "#BE123C",
         "headline": "Shelter indoors", "guidance": "Shelter indoors; automatic SMS to all registered phones in the zone"},
    ],
    "pm_rise": 40.0,
    "temp_rise": 3.0,
    "gas_delta": 150,
    "regional_factor": 2.0,
    "hazardous_pm25": 225.5,
    "hazardous_regional": 150.0,
    "rolling_minutes": 10,
    "sms_dedup_minutes": 60,
    "all_clear_minutes": 30,
    "clear_after_minutes": 3,
}


def band_key(pm25: float, policy: dict) -> str:
    """Round to 1 decimal; first band whose max is null or >= pm25 (CONTRACT §5.1)."""
    value = round(float(pm25), 1)
    bands = policy.get("bands") or DEFAULT_POLICY["bands"]
    for band in bands:
        if band["max"] is None or value <= band["max"]:
            return band["key"]
    return bands[-1]["key"]
