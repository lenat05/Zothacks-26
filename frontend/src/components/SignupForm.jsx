import { useState } from "react";

const UCI_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function validate({ name, email, password }) {
  const errors = {};
  if (!name.trim()) errors.name = "Name is required";
  if (!UCI_EMAIL.test(email)) errors.email = "Must be a valid email";
  if (password.length < 8) errors.password = "Password must be at least 8 characters";
  return errors;
}

export default function SignupForm({ onSwitchToLogin }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"
  const [serverError, setServerError] = useState(null);
  const [resendStatus, setResendStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // clear field error on change
    if (errors[name]) setErrors((e) => ({ ...e, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setStatus("loading");
    setServerError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 201) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(data.detail || "Signup failed. Try again.");
        setStatus(null);
      }
    } catch {
      setServerError("Network error — please try again.");
      setStatus(null);
    }
  };

  const resendEmail = async () => {
    setResendStatus("loading");
    const res = await fetch("/api/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email }),
    });
    setResendStatus(res.ok ? "sent" : "error");
  };

  if (status === "success")
    return (
      <div className="auth-success">
        <p>🎉 You&apos;re signed up! Check your email.</p>
        <button type="button" onClick={resendEmail} disabled={resendStatus === "loading"}>
          {resendStatus === "sent" ? "Email sent!" : "Resend verification email"}
        </button>
        {resendStatus === "error" && <p className="auth-error">Could not resend email.</p>}
      </div>
    );

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2>Sign Up</h2>

      <label>
        Name
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Your name"
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>

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
          placeholder="Min 8 characters"
        />
        {errors.password && <span className="field-error">{errors.password}</span>}
      </label>

      {serverError && <p className="auth-error">{serverError}</p>}

      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Signing up…" : "Sign Up"}
      </button>

      <p className="auth-switch">
        Already have an account?{" "}
        <button type="button" className="link-btn" onClick={onSwitchToLogin}>
          Log in
        </button>
      </p>
    </form>
  );
}
