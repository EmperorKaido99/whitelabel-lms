"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

// Password strength checker (mirrors server-side rules)
const pwChecks = (p: string) => [
  { label: "At least 8 characters", pass: p.length >= 8 },
  { label: "One uppercase letter",  pass: /[A-Z]/.test(p) },
  { label: "One lowercase letter",  pass: /[a-z]/.test(p) },
  { label: "One number",            pass: /[0-9]/.test(p) },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Name form
  const [name, setName]             = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  // Password form
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwMsg, setPwMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const checks = pwChecks(newPw);
  const pwValid = checks.every(c => c.pass);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then((d: Profile) => {
        setProfile(d);
        setName(d.name ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameSaving(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNameMsg({ ok: false, text: data.error ?? "Failed to update." });
      } else {
        setNameMsg({ ok: true, text: "Name updated successfully." });
        setProfile(prev => prev ? { ...prev, name } : prev);
      }
    } catch {
      setNameMsg({ ok: false, text: "Something went wrong." });
    } finally {
      setNameSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (!pwValid) { setPwMsg({ ok: false, text: "New password does not meet requirements." }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "Passwords do not match." }); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({ ok: false, text: data.error ?? "Failed to update password." });
      } else {
        setPwMsg({ ok: true, text: "Password changed successfully." });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      }
    } catch {
      setPwMsg({ ok: false, text: "Something went wrong." });
    } finally {
      setPwSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 6,
    padding: "10px 14px", fontSize: 14, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 500, color: "#7a90bc", marginBottom: 7,
  };
  const cardStyle: React.CSSProperties = {
    background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, padding: "28px 32px", marginBottom: 20,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { outline: none; border-color: #5a7aff !important; box-shadow: 0 0 0 3px rgba(90,122,255,0.15); }
      `}</style>

      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
          <Link href="/dashboard" style={{ color: "#4a5568", fontSize: 13, textDecoration: "none" }}>My Learning</Link>
          <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Profile</span>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/auth" })} style={{ background: "transparent", color: "#7a90bc", border: "1px solid #2a3347", padding: "6px 14px", borderRadius: 5, fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          Sign Out
        </button>
      </nav>

      <main style={{ padding: "40px", maxWidth: 620, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>Account</div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px" }}>Your Profile</h1>
        </div>

        {loading ? (
          <div style={{ color: "#4a5568", fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            {/* Account info */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#7a90bc", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "'IBM Plex Mono', monospace" }}>Account Info</h2>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#3a4a68", marginBottom: 4, fontFamily: "'IBM Plex Mono', monospace" }}>EMAIL</div>
                  <div style={{ fontSize: 14, color: "#c5d0e8" }}>{profile?.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#3a4a68", marginBottom: 4, fontFamily: "'IBM Plex Mono', monospace" }}>ROLE</div>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: "rgba(90,122,255,0.1)", border: "1px solid rgba(90,122,255,0.2)", color: "#8099ff", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {profile?.role}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#3a4a68", marginBottom: 4, fontFamily: "'IBM Plex Mono', monospace" }}>MEMBER SINCE</div>
                  <div style={{ fontSize: 14, color: "#4a5568" }}>
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Update name */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#7a90bc", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "'IBM Plex Mono', monospace" }}>Display Name</h2>
              <form onSubmit={saveName} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    style={inputStyle}
                  />
                </div>
                {nameMsg && (
                  <div style={{ padding: "10px 14px", borderRadius: 6, fontSize: 13, background: nameMsg.ok ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${nameMsg.ok ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`, color: nameMsg.ok ? "#4ade80" : "#f87171" }}>
                    {nameMsg.text}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={nameSaving}
                  style={{ background: nameSaving ? "#3a4a88" : "#5a7aff", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: nameSaving ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif", alignSelf: "flex-start" }}
                >
                  {nameSaving ? "Saving…" : "Save Name"}
                </button>
              </form>
            </div>

            {/* Change password */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#7a90bc", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "'IBM Plex Mono', monospace" }}>Change Password</h2>
              <form onSubmit={savePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Current Password</label>
                  <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>New Password</label>
                  <input
                    type="password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ ...inputStyle, borderColor: newPw && pwValid ? "rgba(74,222,128,0.4)" : "#2a3347" }}
                  />
                  {newPw && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                      {checks.map(c => (
                        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                          <span style={{ color: c.pass ? "#4ade80" : "#4a5568", fontSize: 11 }}>{c.pass ? "✓" : "○"}</span>
                          <span style={{ color: c.pass ? "#4ade80" : "#4a5568" }}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Confirm New Password</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" required style={{ ...inputStyle, borderColor: confirmPw && confirmPw === newPw ? "rgba(74,222,128,0.4)" : "#2a3347" }} />
                </div>
                {pwMsg && (
                  <div style={{ padding: "10px 14px", borderRadius: 6, fontSize: 13, background: pwMsg.ok ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${pwMsg.ok ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`, color: pwMsg.ok ? "#4ade80" : "#f87171" }}>
                    {pwMsg.text}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={pwSaving}
                  style={{ background: pwSaving ? "#3a4a88" : "#5a7aff", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: pwSaving ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif", alignSelf: "flex-start" }}
                >
                  {pwSaving ? "Saving…" : "Change Password"}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
