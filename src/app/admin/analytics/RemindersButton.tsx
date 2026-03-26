"use client";

import { useState } from "react";

export default function RemindersButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const send = async () => {
    if (!confirm("Send due-date reminder emails to all learners with incomplete courses due within 3 days (or overdue)?")) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withinDays: 3 }) });
      const data = await res.json();
      setResult(`Sent ${data.sent} of ${data.total} reminder${data.total === 1 ? "" : "s"}.`);
    } catch {
      setResult("Failed to send reminders.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button
        onClick={send}
        disabled={loading}
        style={{ fontSize: 12, color: loading ? "#3a4a68" : "#fbbf24", border: "1px solid rgba(251,191,36,0.25)", padding: "6px 12px", borderRadius: 5, background: loading ? "#0c0e14" : "rgba(251,191,36,0.06)", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5h9M7 2l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        {loading ? "Sending…" : "Send Reminders"}
      </button>
      {result && <span style={{ fontSize: 12, color: "#4ade80" }}>{result}</span>}
    </div>
  );
}
