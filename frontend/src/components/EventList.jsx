import React from 'react';

export default function EventList({ events, loading }) {
  if (loading) {
    return <p style={{ textAlign: 'center', color: '#97a5d4' }}>Loading campus updates...</p>;
  }

  if (!events || events.length === 0) {
    return <p style={{ textAlign: 'center', color: '#e8fda9' }}>No posts available right now.</p>;
  }

  return (
    <div 
      className="scrollable-post-container"
      style={{
        maxHeight: '600px',       // Limits the frame height so it doesn't leak down the page
        overflowY: 'auto',        // Dynamically forces a vertical scrollbar when items add up
        paddingRight: '10px',     // Clear space for the scrollbar handle
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'               // Gap spacing between incoming posts
      }}
    >
      {events.map((event, index) => (
        /* Structural Placeholder Container for each post */
        <div 
          key={event.id || index} 
          style={{ 
            border: '1px solid #020109', 
            borderRadius: '8px', 
            padding: '15px', 
            backgroundColor: '#00030f' 
          }}
        >
          {/* 
              YOUR TEAMMATE'S CARD DESIGN COMPONENT WILL GO RIGHT HERE 
              Example: <EventCard event={event} />
          */}
          <p style={{ margin: '0 0 5px 0' }}><strong>Post Title:</strong> {event.title}</p>
          <p style={{ margin: '0 0 5px 0' }}>📍 {event.location} | ⏰ {event.time}</p>
          {event.description && <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>{event.description}</p>}
        </div>
      ))}
    </div>
  );
}