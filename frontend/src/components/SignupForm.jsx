import { useState } from "react";

export default function SignupForm() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [status, setStatus] = useState(null); // null | "loading" | "success" | string(error)

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(data.detail || "Signup failed. Try again.");
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("Network error. Is the backend running?");
    }
  };

  if (status === "success")
    return <p className="signup-success">🎉 You&apos;re signed up! Check your email.</p>;

  return (
    <form className="signup-form" onSubmit={handleSubmit}>
      <h2>Sign Up</h2>

      <label>
        Name
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          placeholder="Your name"
        />
      </label>

      <label>
        Email
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          required
          placeholder="you@example.com"
        />
      </label>

      <label>
        Password
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          required
          minLength={8}
          placeholder="Min 8 characters"
        />
      </label>

      {status && status !== "loading" && (
        <p className="signup-error">{status}</p>
      )}

      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Signing up…" : "Sign Up"}
      </button>
    </form>
  );
}
