"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

interface PrereqCourse { id: string; title: string; }

interface EnrollmentRow {
  id: string;
  courseId: string;
  status: string;
  createdAt: string;
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
  const completed = enrollments.filter(e => e.status === "completed");
  const inProgress = enrollments.filter(e => e.status !== "completed" && !e.locked);
  const locked = enrollments.filter(e => e.locked);
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
            { label: "Avg Score", value: avgScore != null ? `${avgScore}%` : "—", icon: "🎯", accent: "#a78bfa" },
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
      </div>
    </div>
  );
}
