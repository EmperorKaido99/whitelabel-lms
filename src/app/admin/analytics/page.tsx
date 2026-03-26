import Link from "next/link";
import { readFile } from "fs/promises";
import path from "path";
import RemindersButton from "./RemindersButton";

interface CatalogCourse {
  id: string;
  title: string;
  version: string;
  categories?: string[];
}

interface CourseStats {
  course: CatalogCourse;
  enrollments: number;
  completions: number;
  avgScore: number | null;
  avgTimeSpent: number | null; // seconds
  avgRating: number | null;
  ratingCount: number;
}

async function getAnalytics() {
  // Load catalog
  let catalog: CatalogCourse[] = [];
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "catalog.json"), "utf-8");
    catalog = JSON.parse(raw);
  } catch { /* empty */ }

  if (catalog.length === 0) return { courseStats: [], totals: { enrollments: 0, completions: 0, learners: 0 } };

  // Load from DB
  const { prisma } = await import("@/adapters/db");

  const [enrollments, allRatings] = await Promise.all([
    prisma.enrollment.findMany({ include: { progress: true, user: true } }),
    prisma.courseRating.findMany(),
  ]);

  const uniqueLearners = new Set(enrollments.map(e => e.userId)).size;
  const totalCompletions = enrollments.filter(e => e.status === "completed").length;

  const courseStats: CourseStats[] = catalog.map(course => {
    const courseEnrollments = enrollments.filter(e => e.courseId === course.id);
    const completions = courseEnrollments.filter(e => e.status === "completed").length;

    const scores = courseEnrollments
      .map(e => e.progress[0]?.score)
      .filter((s): s is number => s != null);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const times = courseEnrollments
      .map(e => e.progress[0]?.timeSpent)
      .filter((t): t is number => t != null);
    const avgTimeSpent = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null;

    const courseRatings = allRatings.filter(r => r.courseId === course.id);
    const avgRating = courseRatings.length > 0
      ? Math.round((courseRatings.reduce((s, r) => s + r.rating, 0) / courseRatings.length) * 10) / 10
      : null;

    return {
      course,
      enrollments: courseEnrollments.length,
      completions,
      avgScore,
      avgTimeSpent,
      avgRating,
      ratingCount: courseRatings.length,
    };
  });

  return {
    courseStats,
    totals: { enrollments: enrollments.length, completions: totalCompletions, learners: uniqueLearners },
  };
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default async function AnalyticsPage() {
  const { courseStats, totals } = await getAnalytics();

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
          <Link href="/admin" style={{ color: "#4a5568", fontSize: 13, textDecoration: "none" }}>Admin</Link>
          <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Analytics</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/ratings" style={{ color: "#7a90bc", fontSize: 13, textDecoration: "none", border: "1px solid #2a3347", padding: "6px 14px", borderRadius: 5 }}>Ratings</Link>
          <Link href="/admin/groups" style={{ color: "#7a90bc", fontSize: 13, textDecoration: "none", border: "1px solid #2a3347", padding: "6px 14px", borderRadius: 5 }}>Groups</Link>
          <Link href="/admin/learners" style={{ color: "#7a90bc", fontSize: 13, textDecoration: "none", border: "1px solid #2a3347", padding: "6px 14px", borderRadius: 5 }}>Manage Learners</Link>
        </div>
      </nav>

      <main style={{ padding: "40px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>Reports</div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px" }}>Analytics</h1>
          <RemindersButton />
          </div>

          {/* Export buttons — plain anchor tags so Next.js does not need client JS */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace", marginRight: 4 }}>EXPORT</span>
            {[
              { label: "Learners", type: "learners" },
              { label: "Enrollments", type: "enrollments" },
              { label: "Progress", type: "progress" },
            ].map(({ label, type }) => (
              <a
                key={type}
                href={`/api/admin/export?type=${type}`}
                download
                style={{
                  fontSize: 12,
                  color: "#7a90bc",
                  textDecoration: "none",
                  border: "1px solid #2a3347",
                  borderRadius: 5,
                  padding: "6px 12px",
                  background: "#0c0e14",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M5.5 1v6M2.5 7l3 3 3-3M1 10h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {label} CSV
              </a>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Active Learners", value: totals.learners, icon: "👥", accent: "#5a7aff" },
            { label: "Total Enrollments", value: totals.enrollments, icon: "📋", accent: "#22d3ee" },
            { label: "Completions", value: totals.completions, icon: "✅", accent: "#4ade80" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.accent }} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, color: "#f0f4ff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#4a5568" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Course breakdown */}
        <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #1e2433" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Course Breakdown</h2>
          </div>

          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 120px 110px 90px 100px", padding: "10px 24px", borderBottom: "1px solid #13161f", background: "#080a0f" }}>
            {["Course", "Enrollments", "Completions", "Completion %", "Avg Score", "Rating", "Avg Time"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace" }}>{h}</span>
            ))}
          </div>

          {courseStats.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>
              No courses published yet.{" "}
              <Link href="/admin/scorm/upload" style={{ color: "#5a7aff" }}>Upload a course</Link>
            </div>
          ) : courseStats.map((s, i) => {
            const completionPct = s.enrollments > 0 ? Math.round((s.completions / s.enrollments) * 100) : 0;
            return (
              <div key={s.course.id} style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 120px 110px 90px 100px", padding: "14px 24px", borderBottom: i < courseStats.length - 1 ? "1px solid #13161f" : "none", alignItems: "center" }}>
                <div>
                  <Link href={`/catalog/${s.course.id}`} style={{ fontSize: 14, fontWeight: 500, color: "#c5d0e8", textDecoration: "none" }}>
                    {s.course.title}
                  </Link>
                  <div style={{ fontSize: 10, color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>SCORM {s.course.version}</div>
                </div>
                <span style={{ fontSize: 14, color: "#7a90bc", fontFamily: "'IBM Plex Mono', monospace" }}>{s.enrollments}</span>
                <span style={{ fontSize: 14, color: "#7a90bc", fontFamily: "'IBM Plex Mono', monospace" }}>{s.completions}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: "#1e2433", borderRadius: 2 }}>
                      <div style={{ width: `${completionPct}%`, height: "100%", background: completionPct >= 70 ? "#4ade80" : completionPct >= 40 ? "#facc15" : "#5a7aff", borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#7a90bc", fontFamily: "'IBM Plex Mono', monospace", minWidth: 32 }}>{completionPct}%</span>
                  </div>
                </div>
                <span style={{ fontSize: 14, color: s.avgScore != null ? "#c5d0e8" : "#3a4a68", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {s.avgScore != null ? `${Math.round(s.avgScore)}%` : "—"}
                </span>
                <div>
                  {s.avgRating != null ? (
                    <Link href="/admin/ratings" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#fbbf24", fontSize: 12 }}>★</span>
                      <span style={{ fontSize: 13, color: "#fbbf24", fontFamily: "'IBM Plex Mono', monospace" }}>{s.avgRating.toFixed(1)}</span>
                      <span style={{ fontSize: 11, color: "#3a4a68" }}>({s.ratingCount})</span>
                    </Link>
                  ) : (
                    <span style={{ fontSize: 13, color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace" }}>—</span>
                  )}
                </div>
                <span style={{ fontSize: 14, color: s.avgTimeSpent != null ? "#c5d0e8" : "#3a4a68", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {s.avgTimeSpent != null ? formatTime(s.avgTimeSpent) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
