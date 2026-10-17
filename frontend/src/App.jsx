import { useState } from "react";
import "./App.css";
import SignupForm from "@/components/SignupForm";
import LoginForm from "@/components/LoginForm";

function App() {
  const [page, setPage] = useState("login");

  return page === "signup"
    ? <SignupForm onSwitchToLogin={() => setPage("login")} />
    : <LoginForm onSwitchToSignup={() => setPage("signup")} />;
}

export default App;
