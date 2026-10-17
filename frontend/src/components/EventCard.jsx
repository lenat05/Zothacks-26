export default function EventCard({ event }) {
  return (
    <article className="event-card">
      <div className="event-card-header">
        <span className="event-date">{event.confirmed ? "Confirmed" : "Unconfirmed"}</span>
      </div>
      <h2>{event.title}</h2>
      <p>{event.description}</p>
      <p className="event-location">Location: {event.lat}, {event.lon}</p>
      <span className="event-tag">{event.tag}</span>
    </article>
  );
}
