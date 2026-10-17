import { useState, useEffect } from "react";
import "./App.css";
import SignupForm from "@/components/SignupForm";
import LoginForm from "@/components/LoginForm";
import EventList from "@/components/EventList";

function App() {
  const [page, setPage] = useState("homepage");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("Anteater"); // Added username state variable

  // Fetch the events from Lena's FastAPI server when page switches to homepage
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
          // Fallback dummy data if server is down so you can test scrolling
          setEvents([
            { title: "Free Petr Stickers!", location: "Aldrich Park", time: "Right Now!", description: "Near the library canopy." },
            { title: "Donut Drop 🍩", location: "Engineering Plaza", time: "12:30 PM", description: "Free donuts." },
            { title: "IEEE Mock Interviews", location: "EH 1200", time: "2:00 PM", description: "Bring your resumes!" },
            { title: "Free Boba!", location: "Student Center", time: "4:00 PM", description: "Sponsored by ASUCI." },
            { title: "Late Night Pizza Popup", location: "Mesa Court Commons", time: "9:00 PM", description: "Free slices." }
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
          {/* Changed title text block to use the dynamic state variable */}
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Hello, {username}! 👋</h1>
          <button onClick={() => setPage("login")} style={{ padding: "8px 16px", backgroundColor: "#efc5eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
            Logout
          </button>
        </header>
        <div style={{ padding: "12px", backgroundColor: "#eff4f9", borderRadius: "8px", fontSize: "0.9rem", color: "#4a4a4a", marginBottom: "20px" }}>
          🛠️ <em>Placeholder: A button or modal to post new events will be linked here later.</em>
        </div>
        <main>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#fcf4fa" }}>Live Updates</h2>
          <EventList events={events} loading={loading} />
        </main>
      </div>
    );
  }

  // This acts as the backup fallback matching your old routing structure
  return page === "signup"
    ? <SignupForm onSwitchToLogin={() => setPage("login")} />
    : <LoginForm onSwitchToSignup={() => setPage("signup")} />;
}

export default App;
