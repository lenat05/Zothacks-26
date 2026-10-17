import { useState, useEffect } from "react";
import "./App.css";
import SignupForm from "@/components/SignupForm";
import LoginForm from "@/components/LoginForm";
import EventCard from "@/components/EventCard"; // <-- 1. Import your EventCard component

function App() {
  const [page, setPage] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => setPage(response.ok ? "homepage" : "login"))
      .catch(() => setPage("login"));
  }, []);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("Anteater");

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setPage("login");
  }

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
          setEvents([]); // Clears events on failure to trigger skeleton/empty state
        } finally {
          setLoading(false);
        }
      }
      fetchFeedData();
    }
  }, [page]);

  if (page === null) return null;

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
          <button onClick={logout} style={{ padding: "8px 16px", backgroundColor: "#efc5eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
            Logout
          </button>
        </header>

        <div style={{ padding: "12px", backgroundColor: "#eff4f9", borderRadius: "8px", fontSize: "0.9rem", color: "#4a4a4a", marginBottom: "20px" }}>
          🛠️ <em>Pop up!</em>
        </div>

        <main>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#213547" }}>Live Updates</h2>
          
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