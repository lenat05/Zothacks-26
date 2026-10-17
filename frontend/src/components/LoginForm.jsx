import { useState } from "react";

const UCI_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function validate({ email, password }) {
  const errors = {};
  if (!UCI_EMAIL.test(email)) errors.email = "Must be a valid email";
  if (password.length < 8) errors.password = "Password must be at least 8 characters";
  return errors;
}

export default function LoginForm({ onSwitchToSignup }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"
  const [serverError, setServerError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setStatus("loading");
    setServerError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 200) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(data.detail || "Login failed. Check your credentials.");
        setStatus(null);
      }
    } catch {
      setServerError("Network error — please try again.");
      setStatus(null);
    }
  };

  if (status === "success")
    return <p className="auth-success">✅ Logged in!</p>;

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2>Log In</h2>

      <label>
        Email
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="user@example.com"
        />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </label>

      <label>
        Password
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Your password"
        />
        {errors.password && <span className="field-error">{errors.password}</span>}
      </label>

      {serverError && <p className="auth-error">{serverError}</p>}

      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Logging in…" : "Log In"}
      </button>

      <p className="auth-switch">
        Don&apos;t have an account?{" "}
        <button type="button" className="link-btn" onClick={onSwitchToSignup}>
          Sign up
        </button>
      </p>
    </form>
  );
}
