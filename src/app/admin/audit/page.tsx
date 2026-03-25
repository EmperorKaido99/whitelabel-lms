"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  targetId: string | null;
  targetType: string | null;
  metadata: string;
  tenantId: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  "login": "#4ade80",
  "tenant.create": "#5a7aff",
  "tenant.delete": "#ef4444",
  "learner.create": "#22d3ee",
  "learner.delete": "#f87171",
  "enrollment.create": "#a78bfa",
  "enrollment.delete": "#fb923c",
  "enrollment.reset": "#fbbf24",
  "course.edit": "#5a7aff",
  "course.delete": "#ef4444",
};

function actionColor(action: string) {
  for (const [key, val] of Object.entries(ACTION_COLORS)) {
    if (action.startsWith(key)) return val;
  }
  return "#7a90bc";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (hrs < 1) return `${mins}m ago`;
  if (days < 1) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (actionFilter) params.set("action", actionFilter);
    const res = await fetch(`/api/admin/audit?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setPages(data.pages);
    }
    setLoading(false);
  }, [page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actionTypes = [
    "", "login", "tenant", "learner", "enrollment", "course"
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", gap: 24, background: "#0c0e14", position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
        <Link href="/admin" style={{ color: "#7a90bc", fontSize: 13, textDecoration: "none" }}>Dashboard</Link>
        <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Audit Log</span>
      </nav>

      <main style={{ padding: "40px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 10 }}>Compliance</div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px" }}>Audit Log</h1>
            <p style={{ fontSize: 13, color: "#4a5568", marginTop: 6 }}>{total} total events</p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#4a5568" }}>Filter:</span>
            {actionTypes.map(a => (
              <button
                key={a || "all"}
                onClick={() => { setActionFilter(a); setPage(1); }}
                style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 5, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif",
                  background: actionFilter === a ? "#5a7aff22" : "transparent",
                  color: actionFilter === a ? "#5a7aff" : "#7a90bc",
                  border: actionFilter === a ? "1px solid #5a7aff44" : "1px solid #2a3347",
                }}
              >
                {a || "All"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#4a5568", fontSize: 14 }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ border: "2px dashed #1e2433", borderRadius: 12, padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>📋</div>
            <p style={{ color: "#4a5568", fontSize: 14 }}>No audit events yet. Actions across the platform will appear here.</p>
          </div>
        ) : (
          <>
            <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e2433" }}>
                    {["Action", "Actor", "Target", "Details", "Time"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#4a5568", fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    let meta: Record<string, unknown> = {};
                    try { meta = JSON.parse(log.metadata); } catch { /* */ }
                    return (
                      <tr key={log.id} style={{ borderBottom: "1px solid #13161f" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: `${actionColor(log.action)}22`, color: actionColor(log.action), border: `1px solid ${actionColor(log.action)}44`, fontFamily: "'IBM Plex Mono', monospace" }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#7a90bc" }}>{log.actorEmail ?? "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#4a5568" }}>
                          {log.targetType && <span style={{ color: "#5a7aff" }}>{log.targetType}: </span>}
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{log.targetId ? log.targetId.slice(0, 12) + "…" : "—"}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: "#4a5568", maxWidth: 240 }}>
                          {Object.entries(meta).slice(0, 3).map(([k, v]) => (
                            <span key={k} style={{ marginRight: 8 }}><span style={{ color: "#3a4a68" }}>{k}:</span> {String(v).slice(0, 30)}</span>
                          ))}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#4a5568", whiteSpace: "nowrap" }}>{timeAgo(log.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "7px 14px", background: "transparent", border: "1px solid #2a3347", borderRadius: 5, color: "#7a90bc", fontSize: 13, cursor: page === 1 ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>← Prev</button>
                <span style={{ padding: "7px 14px", fontSize: 13, color: "#4a5568" }}>Page {page} of {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: "7px 14px", background: "transparent", border: "1px solid #2a3347", borderRadius: 5, color: "#7a90bc", fontSize: 13, cursor: page === pages ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>Next →</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
