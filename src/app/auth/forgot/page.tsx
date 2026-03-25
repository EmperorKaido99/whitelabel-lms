"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const d = await res.json();
        setError(d.error ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { outline: none; border-color: #5a7aff !important; box-shadow: 0 0 0 3px rgba(90,122,255,0.15); }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f0f4ff", letterSpacing: "-0.5px" }}>◆ LMS</div>
          </Link>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginTop: 8 }}>
            Reset Password
          </div>
        </div>

        <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 12, padding: "32px" }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f0f4ff", marginBottom: 10 }}>Check your email</h2>
              <p style={{ fontSize: 14, color: "#7a90bc", lineHeight: 1.6 }}>
                If an account exists for <strong style={{ color: "#c5d0e8" }}>{email}</strong>, we&apos;ve sent a password reset link.
              </p>
              <p style={{ fontSize: 12, color: "#4a5568", marginTop: 16 }}>The link expires in 1 hour.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <p style={{ fontSize: 14, color: "#7a90bc", lineHeight: 1.6 }}>Enter your email address and we&apos;ll send you a link to reset your password.</p>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#7a90bc", marginBottom: 8 }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{ width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" }}
                />
              </div>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#f87171" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ background: loading ? "#3a4a88" : "#5a7aff", color: "#fff", border: "none", borderRadius: 6, padding: "11px 0", fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#3a4a68" }}>
          <Link href="/auth" style={{ color: "#5a7aff", textDecoration: "none" }}>← Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
