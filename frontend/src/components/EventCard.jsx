
export default function EventCard({ event }) {
  const start = new Date(event.starts_at);
  const end = event.ends_at
    ? new Date(event.ends_at)
    : null;

  const formatTime = (date) =>
    date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

  const formatDate = (date) =>
    date.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

  return (
    <article className="event-card">
      <div className="event-card-header">
        <span className="event-date">
          {formatDate(start)}
        </span>
      </div>

      <h2>{event.name}</h2>

      <p className="event-time">
        {startTime} {endTime && `– ${endTime}`}
      </p>

      <p className="event-location">
        Location: {event.latitude ?? event.latitutde},{" "}
        {event.longitude}
      </p>
      <span className="event-tag">{event.tag}</span>
    </article>
  );

  
}
