"use client";

import Link from "next/link";

interface PrereqCourse {
  id: string;
  title: string;
}

export default function LockedCoursePage({
  courseTitle,
  unmetPrereqs,
}: {
  courseTitle: string;
  unmetPrereqs: PrereqCourse[];
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Top bar */}
      <header style={{ borderBottom: "1px solid #13161f", padding: "0 24px", height: 52, display: "flex", alignItems: "center", background: "#0c0e14" }}>
        <Link href="/catalog" style={{ display: "flex", alignItems: "center", gap: 6, color: "#4a5568", textDecoration: "none", fontSize: 13 }}
          onMouseEnter={e => (e.currentTarget.style.color = "#c5d0e8")}
          onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11 7H3M7 11l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Catalog
        </Link>
        <span style={{ color: "#1e2433", fontSize: 12, margin: "0 12px" }}>›</span>
        <span style={{ fontSize: 13, color: "#7a90bc" }}>{courseTitle}</span>
      </header>

      {/* Locked state */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 24 }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f4ff", marginBottom: 12, letterSpacing: "-0.3px" }}>
            Course Locked
          </h1>
          <p style={{ fontSize: 14, color: "#4a5568", lineHeight: 1.7, marginBottom: 32 }}>
            You must complete the following course{unmetPrereqs.length > 1 ? "s" : ""} before accessing <strong style={{ color: "#c5d0e8" }}>{courseTitle}</strong>:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
            {unmetPrereqs.map(p => (
              <Link key={p.id} href={`/catalog/${p.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 8, textDecoration: "none", transition: "border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#5a7aff")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2433")}
              >
                <span style={{ fontSize: 18 }}>📚</span>
                <span style={{ fontSize: 14, color: "#c5d0e8", fontWeight: 500 }}>{p.title}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#5a7aff" }}>Start →</span>
              </Link>
            ))}
          </div>

          <Link href="/dashboard" style={{ fontSize: 13, color: "#4a5568", textDecoration: "none" }}>
            ← Back to my dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
