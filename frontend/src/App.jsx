import { useState, useEffect, useCallback } from "react";
import "./App.css";
import SignupForm from "@/components/SignupForm";
import LoginForm from "@/components/LoginForm";
import EventCard from "@/components/EventCard"; // <-- 1. Import your EventCard component
import EventForm from "@/components/EventForm";

const EVENT_TAGS = ["free food", "free merch", "discounts", "career development"];

function App() {
  const [page, setPage] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return setPage("login");
        const user = await response.json();
        setUsername(user.name);
        setPage("homepage");
      })
      .catch(() => setPage("login"));
  }, []);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("Anteater");
  const [selectedTag, setSelectedTag] = useState("");
  const [showEventForm, setShowEventForm] = useState(false);

  const fetchEvents = useCallback(async (tag = selectedTag) => {
    setLoading(true);
    try {
      const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
      const response = await fetch(`/api/events${query}`);
      if (!response.ok) throw new Error("Couldn’t load events.");
      setEvents(await response.json());
    } catch (error) {
      console.error("Could not load database feed:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTag]);

  async function onLoginSuccess() {
    const response = await fetch("/api/auth/me");
    if (response.ok) setUsername((await response.json()).name);
    setPage("homepage");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setPage("login");
  }

  // Fetch the events from FastAPI server when page switches to homepage
  useEffect(() => {
    if (page === "homepage") {
      fetchEvents();
    }
  }, [page, fetchEvents]);

  if (page === null) return null;

  if (page === "signup") {
    return <SignupForm onSwitchToLogin={() => setPage("login")} onSignupSuccess={() => setPage("homepage")} />;
  }

  if (page === "login") {
    return <LoginForm onSwitchToSignup={() => setPage("signup")} onLoginSuccess={onLoginSuccess} />;
  }

  if (page === "homepage") {
    return (
      <div style={{ maxWidth: "650px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid #eaeaea", paddingBottom: "15px" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Hello, {username}! </h1>
          <button onClick={logout} style={{ padding: "8px 16px", backgroundColor: "#efc5eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
            Logout
          </button>
        </header>

        <div style={{ padding: "12px", backgroundColor: "#eff4f9", borderRadius: "16px", fontSize: "1.2rem", color: "#0a0a0a", marginBottom: "20px" }}>
           <button className="primary-button add-event-button" type="button" onClick={() => setShowEventForm((visible) => !visible)}>
              {showEventForm ? "Close form" : "+ Post an event"}
            </button>
        </div>

        <main>
          <div className="feed-heading">
            <div><span className="eyebrow">AROUND CAMPUS</span><h2>Live updates</h2></div>
            
          </div>

          {showEventForm && <EventForm onCancel={() => setShowEventForm(false)} onCreated={(created) => {
            setShowEventForm(false);
            setSelectedTag("");
            setEvents((current) => [created, ...current.filter((item) => item.id !== created.id)]);
          }} />}

          <div className="tag-filters" aria-label="Filter events by category">
            <button className={!selectedTag ? "active" : ""} type="button" onClick={() => setSelectedTag("")}>All updates</button>
            {EVENT_TAGS.map((tag) => <button key={tag} className={selectedTag === tag ? "active" : ""} type="button" onClick={() => setSelectedTag(tag)}>{tag}</button>)}
          </div>
          
          {/* ---> PUT STEP 2 CODE RIGHT HERE <--- */}
          {loading ? (
            /* Loading Skeleton Placeholders */
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", alignItems: "center", width: "100%" }}>
              {[1, 2, 3].map((n) => (
                <div className="event-card-container skeleton-card" key={n}>
                  <div className="skeleton-line short"></div>
                  <div className="skeleton-line long"></div>
                  <div className="skeleton-line medium"></div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <p>No active events right now.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
              {events.map((eventItem, index) => (
                <div className="event-card-container" key={eventItem.id || index}>
                  <EventCard event={eventItem} onChange={(updates) => setEvents((current) => current.map((item) => item.id === eventItem.id ? { ...item, ...updates } : item))} />
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
 