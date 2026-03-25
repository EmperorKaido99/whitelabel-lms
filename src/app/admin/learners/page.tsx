"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface Learner {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  enrollments: Enrollment[];
}

interface Enrollment {
  id: string;
  status: string;
  courseId: string;
  createdAt: string;
  course: { id: string; title: string } | null;
  progress: { score: number | null; completedAt: string | null }[];
}

interface CatalogCourse {
  id: string;
  title: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function LearnersPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState<Learner | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [bulkCourseId, setBulkCourseId] = useState("");
  const [bulkMode, setBulkMode] = useState<"select" | "csv">("select");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkCsv, setBulkCsv] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [expandedLearner, setExpandedLearner] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const fetchLearners = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/learners");
      if (res.ok) setLearners(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLearners();
    fetch("/api/catalog").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCatalog(data);
    }).catch(() => {});
  }, [fetchLearners]);

  const handleAddLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName, password: newPassword || undefined }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewEmail(""); setNewName(""); setNewPassword("");
        fetchLearners();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to add learner.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLearner = async (userId: string) => {
    if (!confirm("Delete this learner and all their progress?")) return;
    await fetch(`/api/admin/learners/${userId}`, { method: "DELETE" });
    setLearners(prev => prev.filter(l => l.id !== userId));
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEnrollModal || !enrollCourseId) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: showEnrollModal.id, courseId: enrollCourseId }),
      });
      if (res.ok) {
        setShowEnrollModal(null);
        setEnrollCourseId("");
        fetchLearners();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to enroll.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccessMsg("");
    setSubmitting(true);
    try {
      const body = bulkMode === "select"
        ? { courseId: bulkCourseId, userIds: Array.from(bulkSelected) }
        : { courseId: bulkCourseId, emails: bulkCsv.split(/[\n,]/).map(s => s.trim()).filter(Boolean) };

      const res = await fetch("/api/admin/enrollments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message);
        setBulkSelected(new Set());
        setBulkCsv("");
        fetchLearners();
      } else {
        setError(data.error ?? "Bulk enroll failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnenroll = async (enrollmentId: string) => {
    if (!confirm("Remove this enrollment?")) return;
    await fetch(`/api/admin/enrollments/${enrollmentId}`, { method: "DELETE" });
    fetchLearners();
  };

  const handleReset = async (enrollmentId: string) => {
    if (!confirm("Reset this learner's progress? Their completion status and score will be cleared.")) return;
    setResetting(enrollmentId);
    try {
      await fetch(`/api/admin/enrollments/${enrollmentId}/reset`, { method: "POST" });
      fetchLearners();
    } finally {
      setResetting(null);
    }
  };

  const filtered = learners.filter(l =>
    l.email.toLowerCase().includes(search.toLowerCase()) ||
    (l.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #5a7aff !important; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
          <Link href="/admin" style={{ color: "#4a5568", fontSize: 13, textDecoration: "none" }}>Admin</Link>
          <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Learners</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setShowBulkModal(true); setError(""); setSuccessMsg(""); setBulkCourseId(""); setBulkSelected(new Set()); setBulkCsv(""); }}
            style={{ background: "transparent", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.25)", padding: "7px 16px", borderRadius: 5, fontSize: 13, cursor: "pointer", fontWeight: 500, fontFamily: "'IBM Plex Sans', sans-serif" }}
          >
            ⚡ Bulk Enroll
          </button>
          <button
            onClick={() => { setShowAddModal(true); setError(""); }}
            style={{ background: "#5a7aff", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 5, fontSize: 13, cursor: "pointer", fontWeight: 500, fontFamily: "'IBM Plex Sans', sans-serif" }}
          >
            + Add Learner
          </button>
        </div>
      </nav>

      <main style={{ padding: "40px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>Learner Management</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px" }}>Learners</h1>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total Learners", value: learners.length, color: "#5a7aff" },
            { label: "Total Enrollments", value: learners.reduce((s, l) => s + l.enrollments.length, 0), color: "#22d3ee" },
            { label: "Completions", value: learners.reduce((s, l) => s + l.enrollments.filter(e => e.status === "completed").length, 0), color: "#4ade80" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 8, padding: "16px 20px", flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#f0f4ff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: "#4a5568" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e2433", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{filtered.length} learner{filtered.length !== 1 ? "s" : ""}</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{ background: "#111520", border: "1px solid #2a3347", borderRadius: 6, padding: "7px 12px", fontSize: 13, color: "#e2e8f0", outline: "none", width: 240, fontFamily: "'IBM Plex Sans', sans-serif" }}
            />
          </div>

          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#4a5568" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>
              {search ? `No learners matching "${search}"` : "No learners yet. Add one to get started."}
            </div>
          ) : filtered.map((learner, i) => (
            <div key={learner.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #13161f" : "none" }}>
              <div
                style={{ display: "flex", alignItems: "center", padding: "14px 24px", gap: 16, cursor: "pointer" }}
                onClick={() => setExpandedLearner(expandedLearner === learner.id ? null : learner.id)}
                onMouseEnter={e => (e.currentTarget.style.background = "#111520")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#c5d0e8" }}>{learner.name || learner.email}</div>
                  {learner.name && <div style={{ fontSize: 12, color: "#4a5568" }}>{learner.email}</div>}
                </div>
                <div style={{ fontSize: 12, color: "#4a5568" }}>Joined {timeAgo(learner.createdAt)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#7a90bc", background: "#1e2433", padding: "3px 8px", borderRadius: 4 }}>
                    {learner.enrollments.length} course{learner.enrollments.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setShowEnrollModal(learner); setEnrollCourseId(""); setError(""); }}
                    style={{ padding: "5px 10px", borderRadius: 4, background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.15)", color: "#22d3ee", fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}
                  >
                    + Enroll
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteLearner(learner.id); }}
                    style={{ padding: "5px 10px", borderRadius: 4, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}
                  >
                    🗑
                  </button>
                </div>
                <span style={{ color: "#3a4a68", fontSize: 12 }}>{expandedLearner === learner.id ? "▲" : "▼"}</span>
              </div>

              {expandedLearner === learner.id && (
                <div style={{ background: "#080a0f", borderTop: "1px solid #13161f", padding: "12px 24px 16px 40px" }}>
                  {learner.enrollments.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#3a4a68", padding: "8px 0" }}>Not enrolled in any courses.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {learner.enrollments.map(e => (
                        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "#0c0e14", borderRadius: 6, border: "1px solid #1e2433" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: "#c5d0e8" }}>{e.course?.title ?? e.courseId}</div>
                            <div style={{ fontSize: 11, color: "#3a4a68", marginTop: 2 }}>
                              Enrolled {timeAgo(e.createdAt)}
                              {e.progress[0]?.score != null && ` · Score: ${Math.round(e.progress[0].score!)}%`}
                              {e.progress[0]?.completedAt && ` · Completed ${timeAgo(e.progress[0].completedAt!)}`}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, padding: "3px 8px", borderRadius: 3,
                            background: e.status === "completed" ? "rgba(74,222,128,0.1)" : "rgba(90,122,255,0.1)",
                            color: e.status === "completed" ? "#4ade80" : "#5a7aff",
                            border: `1px solid ${e.status === "completed" ? "rgba(74,222,128,0.2)" : "rgba(90,122,255,0.2)"}`,
                          }}>
                            {e.status}
                          </span>
                          {e.status === "completed" && (
                            <button
                              onClick={() => handleReset(e.id)}
                              disabled={resetting === e.id}
                              title="Reset progress"
                              style={{ padding: "4px 10px", borderRadius: 4, background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", color: "#facc15", fontSize: 11, cursor: resetting === e.id ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}
                            >
                              {resetting === e.id ? "…" : "↺ Reset"}
                            </button>
                          )}
                          <button
                            onClick={() => handleUnenroll(e.id)}
                            style={{ padding: "4px 8px", borderRadius: 4, background: "transparent", border: "1px solid #2a3347", color: "#4a5568", fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Add learner modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} title="Add Learner">
          <form onSubmit={handleAddLearner} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Email *"><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required style={inputStyle} /></Field>
            <Field label="Name"><input value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} /></Field>
            <Field label="Password"><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Optional" style={inputStyle} /></Field>
            {error && <div style={errorStyle}>{error}</div>}
            <ModalActions onCancel={() => setShowAddModal(false)} loading={submitting} label="Add Learner" />
          </form>
        </Modal>
      )}

      {/* Enroll modal */}
      {showEnrollModal && (
        <Modal onClose={() => setShowEnrollModal(null)} title={`Enroll ${showEnrollModal.name || showEnrollModal.email}`}>
          <form onSubmit={handleEnroll} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Select Course">
              <select value={enrollCourseId} onChange={e => setEnrollCourseId(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">— Choose a course —</option>
                {catalog.filter(c => !showEnrollModal.enrollments.some(e => e.courseId === c.id)).map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </Field>
            {error && <div style={errorStyle}>{error}</div>}
            <ModalActions onCancel={() => setShowEnrollModal(null)} loading={submitting} label="Enroll" />
          </form>
        </Modal>
      )}

      {/* Bulk enroll modal */}
      {showBulkModal && (
        <Modal onClose={() => setShowBulkModal(false)} title="Bulk Enroll">
          <form onSubmit={handleBulkEnroll} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Course *">
              <select value={bulkCourseId} onChange={e => setBulkCourseId(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">— Select a course —</option>
                {catalog.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>

            {/* Tab toggle */}
            <div style={{ display: "flex", gap: 0, border: "1px solid #2a3347", borderRadius: 6, overflow: "hidden" }}>
              {(["select", "csv"] as const).map(mode => (
                <button key={mode} type="button" onClick={() => setBulkMode(mode)}
                  style={{ flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", fontFamily: "'IBM Plex Sans', sans-serif", background: bulkMode === mode ? "#5a7aff" : "#0c0e14", color: bulkMode === mode ? "#fff" : "#4a5568", transition: "all 0.15s" }}>
                  {mode === "select" ? "Select Learners" : "Paste CSV"}
                </button>
              ))}
            </div>

            {bulkMode === "select" ? (
              <Field label={`Select learners (${bulkSelected.size} selected)`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", background: "#0c0e14", border: "1px solid #2a3347", borderRadius: 6, padding: "8px 10px" }}>
                  {learners.length === 0 && <span style={{ fontSize: 13, color: "#3a4a68" }}>No learners yet</span>}
                  {learners.map(l => (
                    <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#c5d0e8" }}>
                      <input type="checkbox" checked={bulkSelected.has(l.id)}
                        onChange={e => setBulkSelected(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(l.id) : next.delete(l.id);
                          return next;
                        })}
                        style={{ accentColor: "#5a7aff", width: 14, height: 14 }}
                      />
                      <span>{l.name || l.email}</span>
                      {l.name && <span style={{ fontSize: 11, color: "#3a4a68" }}>{l.email}</span>}
                    </label>
                  ))}
                </div>
              </Field>
            ) : (
              <Field label="Emails (one per line or comma-separated)">
                <textarea value={bulkCsv} onChange={e => setBulkCsv(e.target.value)} rows={5} placeholder={"jane@demo.com\njohn@demo.com"} style={{ ...inputStyle, resize: "vertical" }} />
              </Field>
            )}

            {error && <div style={errorStyle}>{error}</div>}
            {successMsg && <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "#4ade80" }}>{successMsg}</div>}
            <ModalActions onCancel={() => setShowBulkModal(false)} loading={submitting} label="Enroll All" />
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#111520", border: "1px solid #2a3347", borderRadius: 10, padding: 32, maxWidth: 480, width: "90%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: "#f0f4ff", marginBottom: 24 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#7a90bc", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, loading, label }: { onCancel: () => void; loading: boolean; label: string }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
      <button type="submit" disabled={loading} style={{ flex: 1, padding: "10px 0", borderRadius: 6, background: loading ? "#3a4a88" : "#5a7aff", border: "none", color: "#fff", fontWeight: 500, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        {loading ? "…" : label}
      </button>
      <button type="button" onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 6, background: "transparent", border: "1px solid #2a3347", color: "#7a90bc", fontSize: 14, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        Cancel
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", background: "#0c0e14", border: "1px solid #2a3347", borderRadius: 6, padding: "9px 12px", fontSize: 13, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" };
const errorStyle: React.CSSProperties = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "#f87171" };
