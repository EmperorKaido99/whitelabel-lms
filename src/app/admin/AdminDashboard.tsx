"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CatalogCourse {
  id: string;
  packageId: string;
  title: string;
  entryPoint: string;
  version: string;
  fileCount: number;
  publishedAt: string;
  sizeBytes?: number;
}

export interface DashboardProps {
  courses: CatalogCourse[];
  totalFiles: number;
  totalSizeBytes: number;
  tenantSlug: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function AdminDashboard({ courses, totalFiles, totalSizeBytes, tenantSlug }: DashboardProps) {
  const router = useRouter();
  const [courseList, setCourseList] = useState(courses);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const scorm12Count = courseList.filter(c => c.version === "1.2").length;
  const scorm2004Count = courseList.filter(c => c.version === "2004").length;

  const filtered = courseList.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (courseId: string) => {
    setDeleting(courseId);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, { method: "DELETE" });
      if (res.ok) {
        setCourseList(prev => prev.filter(c => c.id !== courseId));
      }
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none", letterSpacing: "-0.3px" }}>◆ LMS</Link>
          <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Admin Dashboard</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/catalog" style={ghostBtn}>View Catalog</Link>
          <Link href="/admin/scorm/upload" style={primaryBtn}>+ Upload Course</Link>
        </div>
      </nav>

      <main style={{ padding: "40px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 10 }}>
            Admin Console
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.6px", marginBottom: 4 }}>Dashboard</h1>
              <p style={{ color: "#4a5568", fontSize: 14 }}>
                Tenant: <span style={{ color: "#7a90bc", fontFamily: "'IBM Plex Mono', monospace" }}>{tenantSlug}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 36 }}>
          <StatCard label="Published Courses" value={courseList.length} icon="📚" accent="#5a7aff" />
          <StatCard label="SCORM 1.2" value={scorm12Count} icon="📄" accent="#22d3ee" />
          <StatCard label="SCORM 2004" value={scorm2004Count} icon="📋" accent="#a78bfa" />
          <StatCard label="Storage Used" value={formatBytes(totalSizeBytes)} icon="💾" accent="#4ade80" />
        </div>

        {/* Suggestions banner */}
        <div style={{ background: "rgba(90,122,255,0.06)", border: "1px solid rgba(90,122,255,0.15)", borderRadius: 10, padding: "20px 24px", marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 12 }}>
            Suggested Next Features
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { icon: "👥", title: "Learner Management", desc: "Enroll & manage users per course" },
              { icon: "📊", title: "Progress Tracking", desc: "Completions, scores & time spent" },
              { icon: "✏️", title: "Course Editing", desc: "Rename & update published courses" },
              { icon: "🔐", title: "Admin Auth", desc: "Password-protect the admin area" },
              { icon: "📈", title: "Analytics", desc: "Completion rates & engagement stats" },
              { icon: "🏷️", title: "Course Categories", desc: "Tag & organise courses by topic" },
            ].map(s => (
              <div key={s.title} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: "#0c0e14", borderRadius: 7, border: "1px solid #1e2433" }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#c5d0e8", marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "#4a5568" }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Course Table */}
        <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e2433", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>Published Courses</h2>
              <p style={{ fontSize: 13, color: "#4a5568" }}>{courseList.length} course{courseList.length !== 1 ? "s" : ""} in catalog</p>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search courses…"
              style={{ background: "#111520", border: "1px solid #2a3347", borderRadius: 6, padding: "8px 14px", fontSize: 13, color: "#e2e8f0", outline: "none", width: 220, fontFamily: "'IBM Plex Sans', sans-serif" }}
            />
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 120px 160px 100px", padding: "10px 24px", borderBottom: "1px solid #13161f", background: "#080a0f" }}>
            {["Course Title", "Version", "Files", "Size", "Published", "Actions"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace" }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>
              {search ? `No courses matching "${search}"` : "No courses published yet."}
            </div>
          ) : (
            filtered.map((course, i) => (
              <div key={course.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 120px 160px 100px", padding: "14px 24px", borderBottom: i < filtered.length - 1 ? "1px solid #13161f" : "none", alignItems: "center", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#111520")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Title */}
                <div>
                  <Link href={`/catalog/${course.id}`} style={{ fontSize: 14, fontWeight: 500, color: "#c5d0e8", textDecoration: "none" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#5a7aff")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#c5d0e8")}
                  >
                    {course.title}
                  </Link>
                  <div style={{ fontSize: 11, color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                    {course.id.slice(0, 8)}…
                  </div>
                </div>

                {/* Version badge */}
                <div>
                  <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 8px", borderRadius: 3, background: course.version === "2004" ? "rgba(167,139,250,0.1)" : "rgba(34,211,238,0.1)", border: `1px solid ${course.version === "2004" ? "rgba(167,139,250,0.2)" : "rgba(34,211,238,0.2)"}`, color: course.version === "2004" ? "#a78bfa" : "#22d3ee" }}>
                    SCORM {course.version}
                  </span>
                </div>

                {/* Files */}
                <span style={{ fontSize: 13, color: "#7a90bc", fontFamily: "'IBM Plex Mono', monospace" }}>{course.fileCount}</span>

                {/* Size */}
                <span style={{ fontSize: 13, color: "#7a90bc", fontFamily: "'IBM Plex Mono', monospace" }}>{course.sizeBytes ? formatBytes(course.sizeBytes) : "—"}</span>

                {/* Published */}
                <div>
                  <div style={{ fontSize: 13, color: "#7a90bc" }}>{new Date(course.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  <div style={{ fontSize: 11, color: "#3a4a68" }}>{timeAgo(course.publishedAt)}</div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6 }}>
                  <Link href={`/catalog/${course.id}`} title="Launch course" style={{ padding: "5px 10px", borderRadius: 4, background: "rgba(90,122,255,0.1)", border: "1px solid rgba(90,122,255,0.2)", color: "#5a7aff", fontSize: 12, textDecoration: "none", fontWeight: 500 }}>
                    ▶
                  </Link>
                  {confirmDelete === course.id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleDelete(course.id)} disabled={deleting === course.id} style={{ padding: "5px 8px", borderRadius: 4, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        {deleting === course.id ? "…" : "Yes"}
                      </button>
                      <button onClick={() => setConfirmDelete(null)} style={{ padding: "5px 8px", borderRadius: 4, background: "transparent", border: "1px solid #2a3347", color: "#4a5568", fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(course.id)} title="Delete course" style={{ padding: "5px 10px", borderRadius: 4, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
          <QuickAction href="/admin/scorm/upload" icon="⬆" title="Upload SCORM Package" desc="Add a new course to the platform" accent="#5a7aff" />
          <QuickAction href="/catalog" icon="📚" title="View Course Catalog" desc="See the learner-facing catalog" accent="#22d3ee" />
          <QuickAction href="/" icon="🏠" title="Back to Home" desc="Return to the main landing page" accent="#4ade80" />
        </div>
      </main>

      {/* Confirm delete overlay */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmDelete(null)}>
          <div style={{ background: "#111520", border: "1px solid #2a3347", borderRadius: 10, padding: 32, maxWidth: 400, width: "90%" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f4ff", marginBottom: 8 }}>Delete course?</h3>
            <p style={{ fontSize: 14, color: "#4a5568", marginBottom: 24, lineHeight: 1.6 }}>
              This will remove the course from the catalog and delete all extracted SCORM files from disk. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleDelete(confirmDelete)} disabled={!!deleting} style={{ flex: 1, padding: "10px 0", borderRadius: 6, background: "#ef4444", border: "none", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 6, background: "transparent", border: "1px solid #2a3347", color: "#7a90bc", fontSize: 14, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent: string }) {
  return (
    <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px", marginBottom: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#4a5568", letterSpacing: "0.3px" }}>{label}</div>
    </div>
  );
}

function QuickAction({ href, icon, title, desc, accent }: { href: string; icon: string; title: string; desc: string; accent: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, padding: "20px 22px", transition: "all 0.15s", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = accent; (e.currentTarget as HTMLDivElement).style.background = "#111520"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e2433"; (e.currentTarget as HTMLDivElement).style.background = "#0c0e14"; }}
      >
        <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#c5d0e8", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#4a5568" }}>{desc}</div>
      </div>
    </Link>
  );
}

const primaryBtn: React.CSSProperties = { background: "#5a7aff", color: "#fff", padding: "7px 16px", borderRadius: 5, fontSize: 13, textDecoration: "none", fontWeight: 500 };
const ghostBtn: React.CSSProperties = { background: "transparent", color: "#7a90bc", padding: "7px 16px", borderRadius: 5, fontSize: 13, textDecoration: "none", border: "1px solid #2a3347" };
