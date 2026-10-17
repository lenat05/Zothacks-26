"""
events.py — Event (popup) routes.

Mount in api.py:
    from events import router as events_router
    app.include_router(events_router)

Auth: reads the access_token cookie set by /login.
TODO: replace in-memory stores with Supabase via db.py
"""

import math
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Cookie, HTTPException, status
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/events", tags=["events"])

# ---------------------------------------------------------------------------
# In-memory store  (swap for Supabase when db.py is ready)
# ---------------------------------------------------------------------------
db_events: dict[str, dict[str, Any]] = {}

TAGS = {"free food", "free merch", "discounts", "career development"}

# thresholds
CONFIRM_RADIUS_M = 20   # reports must be within this radius of the event
CONFIRM_COUNT    = 3     # reports needed to mark event "confirmed"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_current_user(access_token: str | None) -> str:
    """Return email from cookie, or 401. TODO: verify JWT / Supabase session."""
    if not access_token or not access_token.startswith("mock-token-for-"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not logged in")
    return access_token.removeprefix("mock-token-for-")


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two lat/lon points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _is_expired(event: dict) -> bool:
    if event.get("expires_at") is None:
        return False
    return datetime.fromisoformat(event["expires_at"]) < datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class EventCreate(BaseModel):
    title: str
    description: str
    tag: str
    lat: float
    lon: float
    expires_at: str | None = None   # ISO-8601 UTC, e.g. "2025-06-01T20:00:00Z"

    @field_validator("title")
    @classmethod
    def title_nonempty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title is required")
        if len(v) > 100:
            raise ValueError("Title must be 100 characters or fewer")
        return v

    @field_validator("tag")
    @classmethod
    def tag_valid(cls, v: str) -> str:
        if v not in TAGS:
            raise ValueError(f"Tag must be one of: {', '.join(sorted(TAGS))}")
        return v

    @field_validator("lat")
    @classmethod
    def lat_range(cls, v: float) -> float:
        if not (-90 <= v <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @field_validator("lon")
    @classmethod
    def lon_range(cls, v: float) -> float:
        if not (-180 <= v <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        return v


class ReportBody(BaseModel):
    still_here: bool  # True = still present, False = gone


class RateBody(BaseModel):
    vote: Literal["up", "down"]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def post_event(
    body: EventCreate,
    access_token: str | None = Cookie(default=None),
) -> dict:
    """Submit a new popup event. Requires login."""
    email = _get_current_user(access_token)

    event_id = str(uuid.uuid4())
    event = {
        "id": event_id,
        "title": body.title,
        "description": body.description,
        "tag": body.tag,
        "lat": body.lat,
        "lon": body.lon,
        "expires_at": body.expires_at,
        "posted_by": email,
        "posted_at": datetime.now(timezone.utc).isoformat(),
        "thumbs_up": 0,
        "thumbs_down": 0,
        "reports_present": [],   # list of {email, lat, lon}
        "reports_gone": [],
        "confirmed": False,      # True once CONFIRM_COUNT nearby "still here" reports
    }
    db_events[event_id] = event
    return _public(event)


@router.get("")
async def list_events(
    lat: float,
    lon: float,
    radius_m: float = 1000,
    tag: str | None = None,
) -> list[dict]:
    """
    Return active events within radius_m metres of (lat, lon).
    Filter by tag if provided.
    """
    results = []
    for event in db_events.values():
        if _is_expired(event):
            continue
        if tag and event["tag"] != tag:
            continue
        dist = _haversine_m(lat, lon, event["lat"], event["lon"])
        if dist <= radius_m:
            results.append({**_public(event), "distance_m": round(dist)})

    results.sort(key=lambda e: e["distance_m"])
    return results


@router.post("/{event_id}/report")
async def report_event(
    event_id: str,
    body: ReportBody,
    access_token: str | None = Cookie(default=None),
) -> dict:
    """
    Report whether a popup is still present or gone.
    Once CONFIRM_COUNT reporters within CONFIRM_RADIUS_M all say "still here",
    the event is marked confirmed.
    """
    email = _get_current_user(access_token)
    event = _get_event(event_id)

    list_key = "reports_present" if body.still_here else "reports_gone"
    # Remove any previous report from this user
    for key in ("reports_present", "reports_gone"):
        event[key] = [r for r in event[key] if r["email"] != email]

    event[list_key].append({"email": email})

    # Recheck confirmation threshold
    event["confirmed"] = len(event["reports_present"]) >= CONFIRM_COUNT

    return {"confirmed": event["confirmed"], "reports_present": len(event["reports_present"])}


@router.post("/{event_id}/rate")
async def rate_event(
    event_id: str,
    body: RateBody,
    access_token: str | None = Cookie(default=None),
) -> dict:
    """Thumbs up or down. One vote per user (replaces previous vote)."""
    email = _get_current_user(access_token)
    event = _get_event(event_id)

    # Remove previous vote
    voters_up   = set(event.get("voters_up",   []))
    voters_down = set(event.get("voters_down",  []))
    voters_up.discard(email)
    voters_down.discard(email)

    if body.vote == "up":
        voters_up.add(email)
    else:
        voters_down.add(email)

    event["voters_up"]    = list(voters_up)
    event["voters_down"]  = list(voters_down)
    event["thumbs_up"]    = len(voters_up)
    event["thumbs_down"]  = len(voters_down)

    return {"thumbs_up": event["thumbs_up"], "thumbs_down": event["thumbs_down"]}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_event(event_id: str) -> dict:
    event = db_events.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if _is_expired(event):
        raise HTTPException(status_code=410, detail="Event has expired")
    return event


def _public(event: dict) -> dict:
    """Strip internal fields before sending to client."""
    return {
        "id":               event["id"],
        "title":            event["title"],
        "description":      event["description"],
        "tag":              event["tag"],
        "lat":              event["lat"],
        "lon":              event["lon"],
        "expires_at":       event["expires_at"],
        "posted_at":        event["posted_at"],
        "thumbs_up":        event["thumbs_up"],
        "thumbs_down":      event["thumbs_down"],
        "confirmed":        event["confirmed"],
        "reports_present":  len(event["reports_present"]),
    }
