"""
events.py — Event (popup) routes.

Mount in api.py:
    from events import router as events_router
    app.include_router(events_router)

Auth: reads the access_token cookie set by /login.
Events are stored in the Supabase `events` table.
"""

import json
import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Cookie, HTTPException, status
from pydantic import BaseModel, field_validator

from api import supabase
from auth import get_current_user

router = APIRouter(prefix="/events", tags=["events"])

TAGS = {"free food", "free merch", "discounts", "career development"}

# thresholds
CONFIRM_RADIUS_M = 20   # reports must be within this radius of the event
CONFIRM_COUNT    = 3     # reports needed to mark event "confirmed"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_current_user(access_token: str | None) -> str:
    """Return email from a validated access-token cookie, or raise 401."""
    return get_current_user(access_token)


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


def _json_object(value: Any) -> dict:
    """Read a JSONB object, tolerating JSON strings and missing legacy values."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return {}
    return value if isinstance(value, dict) else {}


def _string_list(value: Any) -> list[str]:
    """Return a clean string list from a JSONB array."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _report_list(value: Any) -> list[dict]:
    """Return report entries as dictionaries from a JSONB array."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict) and item.get("email")]


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
        "votes": {"up": [], "down": []},
        "reports": {"present": [], "gone": []},
        "confirmed": False,      # True once CONFIRM_COUNT nearby "still here" reports
    }
    response = supabase.table("events").insert(event).execute()
    return _public(response.data[0] if response.data else event)


@router.get("")
async def list_events(tag: str | None = None) -> list[dict]:
    """Return all active events, optionally filtered by tag."""
    response = supabase.table("events").select("*").execute()
    rows = response.data or []
    results = [
        _public(event)
        for event in rows
        if not _is_expired(event) and (not tag or event.get("tag") == tag)
    ]
    if not results:
        logging.warning(
            "No events returned: Supabase rows=%d sample_keys=%s",
            len(rows), list(rows[0].keys()) if rows else [],
        )
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

    reports = _json_object(event.get("reports"))
    # Migrate the old split columns on first write when handling pre-migration rows.
    present = _report_list(reports.get("present", event.get("reports_present", [])))
    gone = _report_list(reports.get("gone", event.get("reports_gone", [])))
    list_key = "present" if body.still_here else "gone"
    # Remove any previous report from this user
    present = [report for report in present if report["email"] != email]
    gone = [report for report in gone if report["email"] != email]
    (present if list_key == "present" else gone).append({"email": email})
    event["confirmed"] = len(present) >= CONFIRM_COUNT
    event["reports"] = {"present": present, "gone": gone}
    supabase.table("events").update({
        "reports": event["reports"],
        "confirmed": event["confirmed"],
    }).eq("id", event_id).execute()

    return {
        "confirmed": event["confirmed"],
        "reports_present": len(present),
        "reports_gone": len(gone),
    }


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
    votes = _json_object(event.get("votes"))
    voters_up = set(_string_list(votes.get("up", event.get("voters_up", []))))
    voters_down = set(_string_list(votes.get("down", event.get("voters_down", []))))
    voters_up.discard(email)
    voters_down.discard(email)

    if body.vote == "up":
        voters_up.add(email)
    else:
        voters_down.add(email)

    event["votes"] = {"up": sorted(voters_up), "down": sorted(voters_down)}
    supabase.table("events").update({
        "votes": event["votes"],
    }).eq("id", event_id).execute()

    return {"thumbs_up": len(voters_up), "thumbs_down": len(voters_down)}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_event(event_id: str) -> dict:
    response = supabase.table("events").select("*").eq("id", event_id).execute()
    event = response.data[0] if response.data else None
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if _is_expired(event):
        raise HTTPException(status_code=410, detail="Event has expired")
    return event


def _public(event: dict) -> dict:
    """Strip internal fields before sending to client."""
    votes = _json_object(event.get("votes"))
    reports = _json_object(event.get("reports"))
    voters_up = _string_list(votes.get("up", event.get("voters_up", [])))
    voters_down = _string_list(votes.get("down", event.get("voters_down", [])))
    reports_present = _report_list(reports.get("present", event.get("reports_present", [])))
    reports_gone = _report_list(reports.get("gone", event.get("reports_gone", [])))
    return {
        "id":               event["id"],
        "title":            event.get("title", event.get("name", "")),
        "description":      event.get("description", ""),
        "tag":              event.get("tag", ""),
        "lat":              event.get("lat", event.get("latitude", event.get("latitutde"))),
        "lon":              event.get("lon", event.get("longitude")),
        "expires_at":       event.get("expires_at"),
        "posted_at":        event.get("posted_at"),
        "thumbs_up":        len(voters_up) if votes or event.get("voters_up") else event.get("thumbs_up", 0),
        "thumbs_down":      len(voters_down) if votes or event.get("voters_down") else event.get("thumbs_down", 0),
        "confirmed":        event.get("confirmed", False),
        "reports_present":  len(reports_present),
        "reports_gone":     len(reports_gone),

    }
