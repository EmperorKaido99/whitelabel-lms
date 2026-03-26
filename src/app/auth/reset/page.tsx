"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Real-time complexity checks
  const checks = [
    { label: "At least 8 characters", pass: password.length >= 8 },
    { label: "One uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "One lowercase letter", pass: /[a-z]/.test(password) },
    { label: "One number", pass: /[0-9]/.test(password) },
  ];
  const passwordValid = checks.every(c => c.pass);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!passwordValid) { setError("Password does not meet the requirements below."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/auth"), 3000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ textAlign: "center", color: "#f87171" }}>
        <p>Invalid reset link. Please request a new one.</p>
        <Link href="/auth/forgot" style={{ color: "#5a7aff", fontSize: 13 }}>Request new link</Link>
      </div>
    );
  }

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
            New Password
          </div>
        </div>

        <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 12, padding: "32px" }}>
          {success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f0f4ff", marginBottom: 10 }}>Password updated!</h2>
              <p style={{ fontSize: 14, color: "#7a90bc" }}>Redirecting you to sign in…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#7a90bc", marginBottom: 8 }}>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  style={{ width: "100%", background: "#111520", border: `1px solid ${password && passwordValid ? "rgba(74,222,128,0.4)" : "#2a3347"}`, borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" }}
                />
                {password && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                    {checks.map(c => (
                      <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                        <span style={{ color: c.pass ? "#4ade80" : "#4a5568", fontSize: 11, lineHeight: 1 }}>{c.pass ? "✓" : "○"}</span>
                        <span style={{ color: c.pass ? "#4ade80" : "#4a5568" }}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#7a90bc", marginBottom: 8 }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
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
                {loading ? "Saving…" : "Set New Password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
