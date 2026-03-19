"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#0f1117",
      fontFamily: "'IBM Plex Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #1e2433",
        padding: "0 40px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0c0e14",
      }}>
        <span style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 16, letterSpacing: "-0.3px" }}>
          ◆ WhiteLabel LMS
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/admin" style={navBtn}>Admin</a>
          <a href="/catalog" style={navBtn}>Catalog</a>
          <a href="/auth" style={{ ...navBtn, background: "#5a7aff", color: "#fff", border: "none" }}>Sign in</a>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 40px",
        textAlign: "center",
        gap: 24,
      }}>
        <div style={{
          fontSize: 11,
          fontFamily: "monospace",
          letterSpacing: 2,
          color: "#5a7aff",
          background: "rgba(90,122,255,0.1)",
          border: "1px solid rgba(90,122,255,0.2)",
          padding: "4px 14px",
          borderRadius: 20,
        }}>
          MULTI-TENANT · SCORM 1.2 + 2004
        </div>

        <h1 style={{
          fontSize: "clamp(36px, 6vw, 64px)",
          fontWeight: 600,
          color: "#f0f4ff",
          letterSpacing: "-1.5px",
          lineHeight: 1.1,
          maxWidth: 700,
        }}>
          Learning infrastructure<br />
          <span style={{ color: "#5a7aff" }}>built to white-label</span>
        </h1>

        <p style={{ fontSize: 17, color: "#4a5568", maxWidth: 480, lineHeight: 1.7 }}>
          Deploy a fully branded LMS for any client. Upload SCORM packages, manage learners, and track completions — all under your domain.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <a href="/admin/scorm/upload" style={{
            background: "#5a7aff",
            color: "#fff",
            padding: "12px 28px",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 500,
            fontSize: 15,
          }}>
            Upload SCORM Package →
          </a>
          <a href="/admin" style={{
            background: "transparent",
            color: "#7a90bc",
            padding: "12px 28px",
            borderRadius: 6,
            textDecoration: "none",
            border: "1px solid #2a3347",
            fontSize: 15,
          }}>
            Admin Dashboard
          </a>
        </div>

        {/* Status */}
        <div style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          marginTop: 16,
          fontSize: 13,
          color: "#4a5568",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
          Server running · Next.js 16 · Prisma SQLite · Auth.js v5
        </div>
      </div>

      {/* Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1,
        borderTop: "1px solid #1e2433",
        background: "#1e2433",
      }}>
        {[
          { icon: "⬆", title: "SCORM Upload", desc: "Validate and store SCORM 1.2 / 2004 packages", href: "/admin/scorm/upload" },
          { icon: "👥", title: "Multi-Tenant", desc: "Isolated data per tenant with custom branding", href: "/admin" },
          { icon: "📊", title: "Progress Tracking", desc: "CMI data persisted per enrollment", href: "/admin" },
        ].map((card) => (
          <a key={card.title} href={card.href} style={{
            background: "#0f1117",
            padding: "32px 28px",
            textDecoration: "none",
            display: "block",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#131824")}
          onMouseLeave={e => (e.currentTarget.style.background = "#0f1117")}
          >
            <div style={{ fontSize: 24, marginBottom: 12 }}>{card.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#c5d0e8", marginBottom: 6 }}>{card.title}</div>
            <div style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.5 }}>{card.desc}</div>
          </a>
        ))}
      </div>
    </main>
  );
}

const navBtn: React.CSSProperties = {
  color: "#7a90bc",
  textDecoration: "none",
  fontSize: 14,
  padding: "6px 14px",
  borderRadius: 5,
  border: "1px solid #2a3347",
};
