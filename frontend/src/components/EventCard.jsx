export default function EventCard({ event }) {
  const lat = Number(event.lat);
  const lon = Number(event.lon);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lon);
  const latDelta = 100 / 111320;
  const lonDelta = 100 / (111320 * Math.cos((lat * Math.PI) / 180));
  const mapUrl = hasLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}&layer=mapnik&marker=${lat},${lon}`
    : null;

  return (
    <article className="event-card">
      <div className="event-card-header">
        <span className="event-date">{event.confirmed ? "Confirmed" : "Unconfirmed"}</span>
      </div>
      <h2>{event.title}</h2>
      <p>{event.description}</p>
      <p className="event-location">Location: {event.lat}, {event.lon}</p>
      {mapUrl && (
        <a
          href={`https://www.google.com/maps?q=${lat},${lon}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${event.title} in Google Maps`}
          style={{ display: "block", cursor: "pointer" }}
        >
          <iframe
            title={`Map showing ${event.title}`}
            src={mapUrl}
            width="100%"
            height="220"
            loading="lazy"
            style={{ border: 0, borderRadius: 8, pointerEvents: "none" }}
          />
        </a>
      )}
      <span className="event-tag">{event.tag}</span>
    </article>
  );
}
