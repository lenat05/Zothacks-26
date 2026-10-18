import { useState } from "react";

const TAGS = ["free food", "free merch", "discounts", "career development"];

export default function EventForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ title: "", description: "", tag: TAGS[0], lat: "", lon: "", expires_at: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Location isn’t available in this browser. Enter coordinates instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setForm((current) => ({ ...current, lat: coords.latitude.toFixed(6), lon: coords.longitude.toFixed(6) })),
      () => setError("Couldn’t get your location. You can enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        lat: Number(form.lat),
        lon: Number(form.lon),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = Array.isArray(result.detail) ? result.detail.map((item) => item.msg).join(" ") : result.detail;
        throw new Error(detail || "Couldn’t post the event.");
      }
      onCreated(result);
    } catch (submitError) {
      setError(submitError.message || "Couldn’t post the event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="event-form" onSubmit={submit}>
      <div className="event-form-heading">
        <div><span className="eyebrow">COMMUNITY UPDATE</span><h2>Post an event</h2></div>
        <button className="text-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <label>Title<input required maxLength={100} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="What’s happening?" /></label>
      <label>Description<textarea required rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Share the details with campus" /></label>
      <label>Category
        <select value={form.tag} onChange={(event) => update("tag", event.target.value)}>
          {TAGS.map((tag) => <option key={tag} value={tag}>{tag.replace(/^./, (letter) => letter.toUpperCase())}</option>)}
        </select>
      </label>
      <div className="coordinate-heading"><span>Event location</span><button className="text-button" type="button" onClick={useMyLocation}>Use my location</button></div>
      <div className="coordinate-fields">
        <label>Latitude<input required type="number" step="any" min="-90" max="90" value={form.lat} onChange={(event) => update("lat", event.target.value)} placeholder="33.6405" /></label>
        <label>Longitude<input required type="number" step="any" min="-180" max="180" value={form.lon} onChange={(event) => update("lon", event.target.value)} placeholder="-117.8443" /></label>
      </div>
      <label>Expires (optional)<input type="datetime-local" value={form.expires_at} onChange={(event) => update("expires_at", event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={saving}>{saving ? "Posting…" : "Post event"}</button>
    </form>
  );
}
