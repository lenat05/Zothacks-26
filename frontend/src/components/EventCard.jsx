import { useState } from "react";

const TAG_LABELS = {
  "free food": "Free food",
  "free merch": "Free merch",
  discounts: "Discounts",
  "career development": "Career development",
};

export default function EventCard({ event, onChange }) {
  const [counts, setCounts] = useState({ up: Number(event.thumbs_up) || 0, down: Number(event.thumbs_down) || 0 });
  const [reportsPresent, setReportsPresent] = useState(Number(event.reports_present) || 0);
  const [reportsGone, setReportsGone] = useState(Number(event.reports_gone) || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lat = Number(event.lat);
  const lon = Number(event.lon);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lon);
  const latDelta = 100 / 111320;
  const lonDelta = 100 / (111320 * Math.cos((lat * Math.PI) / 180));
  const mapUrl = hasLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}&layer=mapnik&marker=${lat},${lon}`
    : null;

  async function sendAction(path, payload) {
    if (!event.id || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Couldn’t save your response.");
      if (path === "rate") setCounts({ up: Number(result.thumbs_up) || 0, down: Number(result.thumbs_down) || 0 });
      if (path === "report") {
        setReportsPresent(Number(result.reports_present) || 0);
        setReportsGone(Number(result.reports_gone) || 0);
        onChange?.({ confirmed: result.confirmed, reports_present: result.reports_present, reports_gone: result.reports_gone });
      }
    } catch (actionError) {
      setError(actionError.message || "Couldn’t save your response.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="event-card">
      <div className="event-card-header">
        <span className={`event-status ${event.confirmed ? "is-confirmed" : ""}`}>
          <span className="status-dot" aria-hidden="true" />{event.confirmed ? "Confirmed" : "Needs confirmation"}
        </span>
        {event.tag && <span className="event-tag">{TAG_LABELS[event.tag] || event.tag}</span>}
      </div>
      <h2>{event.title}</h2>
      {event.description && <p className="event-description">{event.description}</p>}
      {hasLocation && <p className="event-location">📍 {lat.toFixed(5)}, {lon.toFixed(5)}</p>}
      {mapUrl && (
        <a className="event-map-link" href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noreferrer" aria-label={`Open ${event.title} in Google Maps`}>
          <iframe title={`Map showing ${event.title}`} src={mapUrl} width="100%" height="180" loading="lazy" style={{ border: 0, pointerEvents: "none" }} />
        </a>
      )}
      <div className="event-meta">
        <span>{reportsPresent} {reportsPresent === 1 ? "report says" : "reports say"} it’s still here</span>
        <span>{reportsGone} {reportsGone === 1 ? "report says" : "reports say"} it’s gone</span>
        {event.posted_at && <span>Posted {new Date(event.posted_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
        {event.expires_at && <span>Ends {new Date(event.expires_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
      </div>
      <footer className="event-actions">
        <div className="action-group" aria-label="Rate this event">
          <span className="action-label">Helpful?</span>
          <button type="button" onClick={() => sendAction("rate", { vote: "up" })} disabled={busy} aria-label={`Thumbs up, ${counts.up} votes`}>👍 <span>{counts.up}</span></button>
          <button type="button" onClick={() => sendAction("rate", { vote: "down" })} disabled={busy} aria-label={`Thumbs down, ${counts.down} votes`}>👎 <span>{counts.down}</span></button>
        </div>
        <div className="action-group" aria-label="Report event status">
          <span className="action-label">Still here?</span>
          <button type="button" onClick={() => sendAction("report", { still_here: true })} disabled={busy}>Yes</button>
          <button type="button" onClick={() => sendAction("report", { still_here: false })} disabled={busy}>Gone</button>
        </div>
      </footer>
      {error && <p className="vote-error" role="alert">{error}</p>}
    </article>
  );
}
