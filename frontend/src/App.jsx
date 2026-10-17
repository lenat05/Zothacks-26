import { useState, useEffect } from "react";
import "./App.css";
import SignupForm from "@/components/SignupForm";
import LoginForm from "@/components/LoginForm";
import EventCard from "@/components/EventCard"; // <-- 1. Import your EventCard component

function App() {
  const [page, setPage] = useState("homepage");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("Anteater");

  // Fetch the events from FastAPI server when page switches to homepage
  useEffect(() => {
    if (page === "homepage") {
      async function fetchFeedData() {
        try {
          setLoading(true);
          const response = await fetch("http://localhost:8000/events");
          const data = await response.json();
          setEvents(data);
        } catch (error) {
          console.error("Could not load database feed:", error);
          // 2. Updated dummy data keys to match your EventCard props (name, starts_at, tag, etc.)
          setEvents([
            { 
              id: 1, 
              name: "Free Petr Stickers!", 
              latitude: 33.6480, 
              longitude: -117.8415, 
              starts_at: "2026-10-21T10:30:00-07:00", 
              tag: "freebies" 
            },
            { 
              id: 2, 
              name: "Donut Drop 🍩", 
              latitude: 33.6440, 
              longitude: -117.8440, 
              starts_at: "2026-10-21T12:30:00-07:00", 
              tag: "food" 
            },
            { 
              id: 3, 
              name: "IEEE Mock Interviews", 
              latitude: 33.6450, 
              longitude: -117.8420, 
              starts_at: "2026-10-21T14:00:00-07:00", 
              tag: "career" 
            },
          ]);
        } finally {
          setLoading(false);
        }
      }
      fetchFeedData();
    }
  }, [page]);

  if (page === "signup") {
    return <SignupForm onSwitchToLogin={() => setPage("login")} onSignupSuccess={() => setPage("homepage")} />;
  }

  if (page === "login") {
    return <LoginForm onSwitchToSignup={() => setPage("signup")} onLoginSuccess={() => setPage("homepage")} />;
  }

  if (page === "homepage") {
    return (
      <div style={{ maxWidth: "650px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid #eaeaea", paddingBottom: "15px" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Hello, {username}! 👋</h1>
          <button onClick={() => setPage("login")} style={{ padding: "8px 16px", backgroundColor: "#efc5eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
            Logout
          </button>
        </header>

        <div style={{ padding: "12px", backgroundColor: "#eff4f9", borderRadius: "8px", fontSize: "0.9rem", color: "#4a4a4a", marginBottom: "20px" }}>
          🛠️ <em>Placeholder: A button or modal to post new events will be linked here later.</em>
        </div>

        <main>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#213547" }}>Live Updates</h2>
          
          {/* Loading and Event Mapping State */}
          {loading ? (
            <p>Loading events...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
              {events.map((eventItem, index) => (
                <div className="event-card-container" key={eventItem.id || index}>
                  <EventCard event={eventItem} />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

 return page === "signup"
    ? <SignupForm onSwitchToLogin={() => setPage("login")} />
    : <LoginForm onSwitchToSignup={() => setPage("signup")} />;
}

export default App;