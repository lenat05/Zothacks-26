import { useState, useEffect, useCallback } from "react";
import "./App.css";
import SignupForm from "@/components/SignupForm";
import LoginForm from "@/components/LoginForm";
import EventCard from "@/components/EventCard"; // <-- 1. Import your EventCard component
import EventForm from "@/components/EventForm";

const EVENT_TAGS = ["free food", "free merch", "discounts", "career development"];

function TagPreferences({ onSaved }) {
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (tag) => setTags((selected) => selected.includes(tag)
    ? selected.filter((item) => item !== tag)
    : [...selected, tag]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/users/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    if (response.ok) onSaved();
    else setError("Could not save preferences. Try again.");
    setSaving(false);
  };

  return (
    <form className="event-form preferences-form" onSubmit={save}>
      <h2>What should we notify you about?</h2>
      {EVENT_TAGS.map((tag) => (
        <label key={tag} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggle(tag)} />
          {tag}
        </label>
      ))}
      {error && <p className="auth-error">{error}</p>}
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}

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
  const [showPreferences, setShowPreferences] = useState(
    () => new URLSearchParams(window.location.search).get("verified") === "1"
  );

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
        {showPreferences && (
          <TagPreferences onSaved={() => {
            setShowPreferences(false);
            window.history.replaceState({}, "", "/");
          }} />
        )}

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid #eaeaea", paddingBottom: "15px" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#000000" }}>Hello, {username}!</h1>
          {/* UPDATED: Logout button background color is now clean white with a subtle border */}
          <button onClick={logout} style={{ padding: "8px 16px", backgroundColor: "#ffffff", color: "#333333", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontFamily: "inherit" }}>
            Logout
          </button>
        </header>

        <main>
          <div className="feed-heading" style={{ marginBottom: "20px" }}>
            <div><span className="eyebrow" style={{ color: "#000000" }}>AROUND CAMPUS</span><h2 style={{ color: "#000000" }}>Live updates</h2></div>
            <button className="primary-button add-event-button" type="button" onClick={() => setShowEventForm((visible) => !visible)}>
              {showEventForm ? "Close form" : "+ Post an event"}
            </button>
          </div>

          {showEventForm && <EventForm onCancel={() => setShowEventForm(false)} onCreated={(created) => {
            setShowEventForm(false);
            setSelectedTag("");
            setEvents((current) => [created, ...current.filter((item) => item.id !== created.id)]);
          }} />}

          {/* Yellow background highlight capsule tag filtering bar loops */}
          <div className="tag-filters" aria-label="Filter events by category" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "25px" }}>
            <button 
              type="button" 
              onClick={() => setSelectedTag("")}
              style={{ 
                padding: "8px 14px", 
                borderRadius: "20px", 
                border: "1px solid #ccc", 
                cursor: "pointer", 
                backgroundColor: !selectedTag ? '#ffd700' : '#ffffff', 
                color: '#333', 
                fontWeight: "bold",
                fontFamily: "inherit"
              }}
            >
              all
            </button>
            {EVENT_TAGS.map((tag) => (
              <button 
                key={tag} 
                type="button" 
                onClick={() => setSelectedTag(tag)}
                style={{ 
                  padding: "8px 14px", 
                  borderRadius: "20px", 
                  border: "1px solid #ccc", 
                  cursor: "pointer", 
                  backgroundColor: selectedTag === tag ? '#ffd700' : '#ffffff', 
                  color: '#333', 
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                  fontWeight: selectedTag === tag ? "bold" : "normal"
                }}
              >
                {tag.replace('_', ' ')}
              </button>
            ))}
          </div>
          
          {/* Loading and Event Mapping State */}
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
            <p style={{ color: "#fff" }}>No active events right now.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
              {events.map((eventItem, index) => (
                <div className="event-card-container" key={eventItem.id || index} style={{ width: "100%" }}>
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
