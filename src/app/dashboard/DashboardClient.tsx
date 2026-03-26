"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";

interface PrereqCourse { id: string; title: string; }

interface EnrollmentRow {
  id: string;
  courseId: string;
  status: string;
  createdAt: string;
  dueDate: string | null;
  courseTitle: string;
  courseDescription?: string;
  categories: string[];
  score: number | null;
  completedAt: string | null;
  timeSpent: number | null;
  locked: boolean;
  unmetPrereqs: PrereqCourse[];
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardClient({
  enrollments,
  learnerName,
}: {
  enrollments: EnrollmentRow[];
  learnerName: string;
}) {
  const now = Date.now();
  const completed = enrollments.filter(e => e.status === "completed");
  const inProgress = enrollments.filter(e => e.status !== "completed" && !e.locked);
  const locked = enrollments.filter(e => e.locked);
  const overdueCount = inProgress.filter(e => e.dueDate && new Date(e.dueDate).getTime() < now).length;
  const avgScore = completed.filter(e => e.score != null).length > 0
    ? Math.round(completed.filter(e => e.score != null).reduce((s, e) => s + e.score!, 0) / completed.filter(e => e.score != null).length)
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
          <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>My Learning</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/catalog" style={{ color: "#7a90bc", fontSize: 13, textDecoration: "none", border: "1px solid #2a3347", padding: "6px 14px", borderRadius: 5 }}>Browse Catalog</Link>
          <Link href="/profile" style={{ color: "#7a90bc", fontSize: 13, textDecoration: "none", border: "1px solid #2a3347", padding: "6px 14px", borderRadius: 5 }}>Profile</Link>
          <button onClick={() => signOut({ callbackUrl: "/auth" })} style={{ background: "transparent", color: "#7a90bc", border: "1px solid #2a3347", padding: "6px 14px", borderRadius: 5, fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Sign Out
          </button>
        </div>
      </nav>

      <main style={{ padding: "40px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 10 }}>Learner Dashboard</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px" }}>Welcome back, {learnerName.split(" ")[0]}</h1>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 36 }}>
          {[
            { label: "Enrolled", value: enrollments.length, icon: "📚", accent: "#5a7aff" },
            { label: "In Progress", value: inProgress.length, icon: "▶", accent: "#22d3ee" },
            { label: "Completed", value: completed.length, icon: "✅", accent: "#4ade80" },
            { label: overdueCount > 0 ? "Overdue" : "Avg Score", value: overdueCount > 0 ? overdueCount : (avgScore != null ? `${avgScore}%` : "—"), icon: overdueCount > 0 ? "⚠" : "🎯", accent: overdueCount > 0 ? "#f87171" : "#a78bfa" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.accent }} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: "#f0f4ff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#4a5568" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {enrollments.length === 0 && (
          <div style={{ border: "2px dashed #1e2433", borderRadius: 12, padding: "72px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.3 }}>📚</div>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: "#c5d0e8", marginBottom: 8 }}>No courses yet</h2>
            <p style={{ color: "#4a5568", fontSize: 14, marginBottom: 24 }}>You haven&apos;t been enrolled in any courses yet.</p>
            <Link href="/catalog" style={{ background: "#5a7aff", color: "#fff", padding: "10px 24px", borderRadius: 6, textDecoration: "none", fontWeight: 500, fontSize: 14 }}>Browse Catalog</Link>
          </div>
        )}

        {inProgress.length > 0 && (
          <Section title="In Progress" count={inProgress.length}>
            {inProgress.map((e, i) => <CourseCard key={e.id} enrollment={e} index={i} />)}
          </Section>
        )}

        {completed.length > 0 && (
          <Section title="Completed" count={completed.length}>
            {completed.map((e, i) => <CourseCard key={e.id} enrollment={e} index={i} completed />)}
          </Section>
        )}

        {locked.length > 0 && (
          <Section title="Locked" count={locked.length}>
            {locked.map((e, i) => <CourseCard key={e.id} enrollment={e} index={i} isLocked />)}
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>{title}</h2>
        <span style={{ fontSize: 12, color: "#4a5568", background: "#1e2433", padding: "2px 8px", borderRadius: 4 }}>{count}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function StarRating({ courseId }: { courseId: string }) {
  const [hover, setHover] = useState(0);
  const [selected, setSelected] = useState(0);
  const [savedRating, setSavedRating] = useState(0);  // what's already in DB
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing rating on mount
  useEffect(() => {
    fetch(`/api/ratings?courseId=${encodeURIComponent(courseId)}`)
      .then(r => r.json())
      .then((data: { mine?: { rating: number; comment: string | null } | null }) => {
        if (data.mine) {
          setSavedRating(data.mine.rating);
          setSelected(data.mine.rating);
          setComment(data.mine.comment ?? "");
        }
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false));
  }, [courseId]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, rating: selected, comment }),
    });
    setSavedRating(selected);
    setSubmitting(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
    setShowComment(false);
  };

  if (loading) return null;

  const isUpdate = savedRating > 0;
  const label = isUpdate ? "Your rating:" : "Rate this course:";

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #13161f" }}>
      <div style={{ fontSize: 11, color: "#3a4a68", marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.5px", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: showComment ? 10 : 0 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => { setSelected(n); setShowComment(true); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, lineHeight: 1, padding: "0 2px",
              color: n <= (hover || selected) ? "#fbbf24" : "#2a3347",
              transition: "color 0.1s",
            }}
          >★</button>
        ))}
        {isUpdate && !showComment && (
          <button
            onClick={() => setShowComment(true)}
            style={{ marginLeft: 8, fontSize: 11, color: "#5a7aff", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'IBM Plex Sans', sans-serif" }}
          >
            Edit
          </button>
        )}
        {done && (
          <span style={{ marginLeft: 8, fontSize: 12, color: "#4ade80" }}>
            {isUpdate ? "Updated!" : "Thanks!"}
          </span>
        )}
      </div>
      {showComment && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Leave a comment (optional)…"
            style={{ flex: 1, background: "#111520", border: "1px solid #2a3347", borderRadius: 4, padding: "6px 10px", fontSize: 12, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" }}
          />
          <button
            onClick={submit}
            disabled={!selected || submitting}
            style={{ background: "#5a7aff", color: "#fff", border: "none", borderRadius: 4, padding: "6px 14px", fontSize: 12, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? "…" : isUpdate ? "Update" : "Submit"}
          </button>
          <button
            onClick={() => { setShowComment(false); setSelected(savedRating); }}
            style={{ background: "none", border: "1px solid #2a3347", color: "#4a5568", borderRadius: 4, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function CourseCard({ enrollment: e, index, completed, isLocked }: { enrollment: EnrollmentRow; index: number; completed?: boolean; isLocked?: boolean }) {
  const colors = [
    { accent: "#5a7aff", bg: "rgba(90,122,255,0.06)", border: "rgba(90,122,255,0.12)" },
    { accent: "#22d3ee", bg: "rgba(34,211,238,0.06)", border: "rgba(34,211,238,0.12)" },
    { accent: "#a78bfa", bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.12)" },
    { accent: "#4ade80", bg: "rgba(74,222,128,0.06)", border: "rgba(74,222,128,0.12)" },
  ];
  const color = isLocked
    ? { accent: "#4a5568", bg: "rgba(74,85,104,0.06)", border: "rgba(74,85,104,0.12)" }
    : colors[index % colors.length];

  return (
    <div style={{ background: "#0c0e14", border: `1px solid ${color.border}`, borderRadius: 10, overflow: "hidden", opacity: isLocked ? 0.7 : 1 }}>
      <div style={{ height: 3, background: isLocked ? "#2a3347" : `linear-gradient(90deg, ${color.accent}, transparent)` }} />
      <div style={{ padding: "18px 20px" }}>
        {e.categories.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {e.categories.slice(0, 2).map(cat => (
              <span key={cat} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 3, background: color.bg, color: color.accent, border: `1px solid ${color.border}` }}>{cat}</span>
            ))}
          </div>
        )}

        <h3 style={{ fontSize: 15, fontWeight: 600, color: isLocked ? "#4a5568" : "#e2e8f0", marginBottom: 6, lineHeight: 1.4 }}>{e.courseTitle}</h3>

        {isLocked && e.unmetPrereqs.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "#4a5568", marginBottom: 6 }}>Complete first:</p>
            {e.unmetPrereqs.map(p => (
              <Link key={p.id} href={`/catalog/${p.id}`} style={{ display: "block", fontSize: 12, color: "#5a7aff", textDecoration: "none", marginBottom: 2 }}>→ {p.title}</Link>
            ))}
          </div>
        )}

        {!isLocked && (
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {e.score != null && <span style={{ fontSize: 12, color: "#c5d0e8", fontFamily: "'IBM Plex Mono', monospace" }}>Score: <strong>{Math.round(e.score)}%</strong></span>}
            {e.timeSpent != null && <span style={{ fontSize: 12, color: "#4a5568", fontFamily: "'IBM Plex Mono', monospace" }}>{formatTime(e.timeSpent)} spent</span>}
            {e.completedAt && <span style={{ fontSize: 12, color: "#4a5568" }}>Completed {timeAgo(e.completedAt)}</span>}
            {!e.completedAt && <span style={{ fontSize: 12, color: "#4a5568" }}>Enrolled {timeAgo(e.createdAt)}</span>}
            {e.dueDate && !e.completedAt && (() => {
              const due = new Date(e.dueDate);
              const msLeft = due.getTime() - Date.now();
              const daysLeft = Math.ceil(msLeft / 86400000);
              const overdue = msLeft < 0;
              const soon = !overdue && daysLeft <= 3;
              return (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 3, fontFamily: "'IBM Plex Mono', monospace", background: overdue ? "rgba(239,68,68,0.12)" : soon ? "rgba(250,204,21,0.12)" : "rgba(74,85,104,0.1)", color: overdue ? "#f87171" : soon ? "#fbbf24" : "#4a5568", border: `1px solid ${overdue ? "rgba(239,68,68,0.2)" : soon ? "rgba(250,204,21,0.2)" : "rgba(74,85,104,0.15)"}` }}>
                  {overdue ? `Overdue ${Math.abs(daysLeft)}d` : daysLeft === 0 ? "Due today" : `Due in ${daysLeft}d`}
                </span>
              );
            })()}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, padding: "3px 8px", borderRadius: 3, fontFamily: "'IBM Plex Mono', monospace",
            background: isLocked ? "rgba(74,85,104,0.15)" : completed ? "rgba(74,222,128,0.1)" : "rgba(90,122,255,0.1)",
            color: isLocked ? "#4a5568" : completed ? "#4ade80" : "#5a7aff",
            border: `1px solid ${isLocked ? "rgba(74,85,104,0.2)" : completed ? "rgba(74,222,128,0.2)" : "rgba(90,122,255,0.2)"}`,
          }}>
            {isLocked ? "locked" : e.status}
          </span>
          <div style={{ flex: 1 }} />
          {completed && (
            <Link href={`/certificate/${e.id}`} style={{ fontSize: 12, color: "#4ade80", textDecoration: "none", border: "1px solid rgba(74,222,128,0.2)", padding: "5px 10px", borderRadius: 4, background: "rgba(74,222,128,0.05)" }}>
              🏆 Certificate
            </Link>
          )}
          {!isLocked && (
            <Link href={`/catalog/${e.courseId}`} style={{ fontSize: 12, color: color.accent, textDecoration: "none", border: `1px solid ${color.border}`, padding: "5px 10px", borderRadius: 4, background: color.bg }}>
              {completed ? "Retake" : "Continue →"}
            </Link>
          )}
        </div>
        {completed && <StarRating courseId={e.courseId} />}
      </div>
    </div>
  );
}
