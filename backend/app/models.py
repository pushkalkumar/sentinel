from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (JSON, Boolean, Float, ForeignKey, Index, Integer, String, Text,
                        UniqueConstraint)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Base(DeclarativeBase):
    type_annotation_map = {dict: JSON, list: JSON}


# ---------------------------------------------------------------- tenancy

class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(20))            # school|warehouse|neighbourhood|agency
    policy_pack: Mapped[dict] = mapped_column(JSON, default=dict)   # thresholds, see §5.1
    sites: Mapped[list["Site"]] = relationship(back_populates="tenant")


class Site(Base):
    __tablename__ = "sites"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(20))            # campus|floorplan
    geom: Mapped[dict] = mapped_column(JSON)                 # GeoJSON Polygon
    map_asset: Mapped[str] = mapped_column(String(200))      # "/maps/roosevelt-campus.svg" (frontend static)
    floor_plan_url: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    address: Mapped[str] = mapped_column(String(200), default="")
    access_notes: Mapped[str] = mapped_column(Text, default="")   # warehouse "notify fire dept" prefill
    tenant: Mapped["Tenant"] = relationship(back_populates="sites")


class Zone(Base):
    __tablename__ = "zones"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    geom: Mapped[dict] = mapped_column(JSON)                 # GeoJSON Polygon
    map_poly: Mapped[list] = mapped_column(JSON)             # [[x,y],...] viewBox units


class Node(Base):
    __tablename__ = "nodes"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)   # slug
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"), index=True)
    label: Mapped[str] = mapped_column(String(120))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    map_x: Mapped[float] = mapped_column(Float)
    map_y: Mapped[float] = mapped_column(Float)
    floor: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    indoor: Mapped[bool] = mapped_column(Boolean, default=True)
    is_gateway: Mapped[bool] = mapped_column(Boolean, default=False)
    neighbours: Mapped[list] = mapped_column(JSON, default=list)    # mesh link slugs
    fw_version: Mapped[str] = mapped_column(String(32), default="0.9.2-sim")
    last_seen: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)   # (sim) ts of last reading
    battery_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rssi: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


# ---------------------------------------------------------------- telemetry

class Reading(Base):
    __tablename__ = "readings"
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), primary_key=True)
    ts: Mapped[str] = mapped_column(String(32), primary_key=True)  # (sim) composite PK => idempotent ingest
    pm1: Mapped[float] = mapped_column(Float)
    pm25: Mapped[float] = mapped_column(Float)
    pm10: Mapped[float] = mapped_column(Float)
    temp_c: Mapped[float] = mapped_column(Float)
    rh: Mapped[float] = mapped_column(Float)
    mq2_raw: Mapped[int] = mapped_column(Integer)
    rssi: Mapped[int] = mapped_column(Integer)
    battery_pct: Mapped[float] = mapped_column(Float)
    received_at: Mapped[str] = mapped_column(String(32), default=now_iso)   # (wall)

Index("ix_readings_ts", Reading.ts)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"))
    node_id: Mapped[Optional[str]] = mapped_column(ForeignKey("nodes.id"), nullable=True)  # null for site-wide ADVISORY
    kind: Mapped[str] = mapped_column(String(32))            # LOCAL_FIRE|HAZARDOUS_SMOKE|LOCAL_SMOKE_SUSPECT|ACTIVITY_ADVISORY
    priority: Mapped[int] = mapped_column(Integer)           # 1..4
    band_from: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    band_to: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")    # human sentence for the UI
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)  # {pm25, pm_rise, temp_rise, gas_delta, regional}
    started_at: Mapped[str] = mapped_column(String(32))      # (sim)
    cleared_at: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # (sim)

Index("ix_alerts_open", Alert.node_id, Alert.kind, Alert.cleared_at)


class DecisionLog(Base):
    """One row every time a site's outdoor-activity band changes (the decision card log)."""
    __tablename__ = "decision_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    band_from: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    band_to: Mapped[str] = mapped_column(String(16))
    pm25: Mapped[float] = mapped_column(Float)               # 10-min rolling avg that drove the change
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"))
    guidance: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)                  # "Practice cancelled 13:55, PM2.5 71 at Field node"
    changed_at: Mapped[str] = mapped_column(String(32))      # (sim)


class NodeEval(Base):
    """Rolling window of engine evaluations per node (NOVELTY §3.2). backend-alerts writes; keeps last 60 per node."""
    __tablename__ = "node_evals"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    sim_ts: Mapped[str] = mapped_column(String(32), index=True)
    pm25: Mapped[float] = mapped_column(Float)
    pm_rise: Mapped[float] = mapped_column(Float)
    temp_rise: Mapped[float] = mapped_column(Float)
    gas_delta: Mapped[float] = mapped_column(Float)
    regional: Mapped[float] = mapped_column(Float)
    ratio: Mapped[float] = mapped_column(Float)                 # pm25 / regional
    neighbour_ids: Mapped[list] = mapped_column(JSON, default=list)
    neighbour_pm25: Mapped[list] = mapped_column(JSON, default=list)
    branch: Mapped[str] = mapped_column(String(24))             # LOCAL_FIRE|HAZARDOUS_SMOKE|LOCAL_SMOKE_SUSPECT|CLEAR
    thresholds: Mapped[dict] = mapped_column(JSON, default=dict)


# ---------------------------------------------------------------- sms

class SmsRecipient(Base):
    __tablename__ = "sms_recipients"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"), index=True)
    phone_e164: Mapped[str] = mapped_column(String(20))
    label: Mapped[str] = mapped_column(String(80), default="")   # "Parent · 3B", "Crew lead"
    consent_at: Mapped[str] = mapped_column(String(32), default=now_iso)
    opted_out_at: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    __table_args__ = (UniqueConstraint("zone_id", "phone_e164"),)


class SmsLog(Base):
    __tablename__ = "sms_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("sms_recipients.id"))
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"), index=True)
    phone_e164: Mapped[str] = mapped_column(String(20))
    body: Mapped[str] = mapped_column(Text)
    severity: Mapped[int] = mapped_column(Integer)           # alert priority 1..4; 0 = all-clear
    status: Mapped[str] = mapped_column(String(16), default="simulated")   # only value today
    provider_msg_id: Mapped[str] = mapped_column(String(40))  # "SIM-<8hex>"
    sent_at: Mapped[str] = mapped_column(String(32), default=now_iso)   # (wall)
    sim_at: Mapped[str] = mapped_column(String(32))          # (sim) ts of triggering reading


# ---------------------------------------------------------------- people

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    role: Mapped[str] = mapped_column(String(16))            # admin|teacher|responder
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[Optional[str]] = mapped_column(String(120), unique=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)   # sha256 hex (demo)
    staff_code_hash: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)  # sha256 hex


class SchoolClass(Base):
    __tablename__ = "classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    name: Mapped[str] = mapped_column(String(32))            # "3B"
    teacher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    muster_node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"))   # default muster point
    roster: Mapped[list["RosterEntry"]] = relationship(cascade="all, delete-orphan")


class RosterEntry(Base):
    __tablename__ = "roster"
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), primary_key=True)
    student_ref: Mapped[str] = mapped_column(String(16), primary_key=True)   # "S-3B-01"


# ---------------------------------------------------------------- drills

class Drill(Base):
    __tablename__ = "drills"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))            # fire|earthquake|lockdown
    is_real: Mapped[bool] = mapped_column(Boolean, default=False)   # true when engine starts it
    started_at: Mapped[str] = mapped_column(String(32), default=now_iso)   # (wall)
    ended_at: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)   # (wall)
    started_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)


class Rollcall(Base):
    __tablename__ = "rollcalls"
    id: Mapped[int] = mapped_column(primary_key=True)
    drill_id: Mapped[int] = mapped_column(ForeignKey("drills.id"), index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"))
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"))
    present: Mapped[int] = mapped_column(Integer)
    missing_refs: Mapped[list] = mapped_column(JSON, default=list)
    submitted_at: Mapped[str] = mapped_column(String(32), default=now_iso)   # (wall)
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    __table_args__ = (UniqueConstraint("drill_id", "class_id"),)   # resubmit = UPDATE


# ---------------------------------------------------------------- incidents

class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True)   # "SN-7K3F"
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    site_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sites.id"), nullable=True)
    node_id: Mapped[Optional[str]] = mapped_column(ForeignKey("nodes.id"), nullable=True)
    via: Mapped[str] = mapped_column(String(8))              # node|internet
    type: Mapped[str] = mapped_column(String(16))            # safe|water|medical|trapped|fire|other
    count: Mapped[int] = mapped_column(Integer, default=1)
    text: Mapped[str] = mapped_column(Text, default="")
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    device_fp: Mapped[str] = mapped_column(String(64), index=True)
    reporter_role: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)   # set when bearer present
    trust_score: Mapped[int] = mapped_column(Integer)
    trust_label: Mapped[str] = mapped_column(String(16))     # verified|likely|unverified
    trust_breakdown: Mapped[list] = mapped_column(JSON)      # [{layer, points, note}]
    priority: Mapped[int] = mapped_column(Integer)           # from type, see §3.6
    status: Mapped[str] = mapped_column(String(16), default="received")  # received|acknowledged|en_route|resolved|false|queued
    created_at: Mapped[str] = mapped_column(String(32), default=now_iso)   # (wall)
    updated_at: Mapped[str] = mapped_column(String(32), default=now_iso)   # (wall)
    sim_at: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)   # (sim) sim_ts at creation, for the Time Machine track
    events: Mapped[list["IncidentEvent"]] = relationship(order_by="IncidentEvent.id", cascade="all, delete-orphan")


class IncidentEvent(Base):
    __tablename__ = "incident_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    actor_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    actor_role: Mapped[str] = mapped_column(String(16))      # civilian|system|admin|teacher|responder
    action: Mapped[str] = mapped_column(String(24))          # created|relayed|acknowledge|en_route|resolve|flag_false|message
    note: Mapped[str] = mapped_column(Text, default="")
    ip: Mapped[str] = mapped_column(String(45), default="")
    at: Mapped[str] = mapped_column(String(32), default=now_iso)   # (wall)


class DeviceHistory(Base):
    __tablename__ = "device_history"
    device_fp: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), primary_key=True)
    false_flags: Mapped[int] = mapped_column(Integer, default=0)
    blocked_at: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)


# ---------------------------------------------------------------- mesh

class MeshLog(Base):
    """One row per hop attempt reported by the simulator (POST /api/ingest/mesh-message)."""
    __tablename__ = "mesh_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    msg_id: Mapped[str] = mapped_column(String(16), index=True)
    origin_node: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(16))            # incident|alarm|telemetry
    hop_from: Mapped[str] = mapped_column(String(32))
    hop_to: Mapped[str] = mapped_column(String(32))
    attempt: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16))          # ok|dropped|retry|delivered|failed
    path: Mapped[list] = mapped_column(JSON)                 # slugs traversed so far, origin first
    ttl: Mapped[int] = mapped_column(Integer)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    ts: Mapped[str] = mapped_column(String(32), default=now_iso)   # (wall)
