"use client";

import Link from "next/link";

interface Props {
  enrollmentId: string;
  learnerName: string;
  courseTitle: string;
  completedAt: string;
  score: number | null;
}

export default function CertificatePage({ learnerName, courseTitle, completedAt, score }: Props) {
  const completionDate = new Date(completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,600;1,600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .cert-card {
            border: 2px solid #1e2433 !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Top bar — hidden when printing */}
      <nav className="no-print" style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
          <Link href="/dashboard" style={{ color: "#4a5568", fontSize: 13, textDecoration: "none" }}>← My Dashboard</Link>
        </div>
        <button
          onClick={() => window.print()}
          style={{ background: "#5a7aff", color: "#fff", border: "none", padding: "7px 18px", borderRadius: 5, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          🖨 Print Certificate
        </button>
      </nav>

      {/* Certificate */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div
          className="cert-card"
          style={{
            background: "#0c0e14",
            border: "1px solid #2a3347",
            borderRadius: 16,
            padding: "64px 72px",
            maxWidth: 720,
            width: "100%",
            textAlign: "center",
            position: "relative",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          }}
        >
          {/* Corner accents */}
          <div style={{ position: "absolute", top: 20, left: 20, width: 32, height: 32, borderTop: "2px solid #5a7aff", borderLeft: "2px solid #5a7aff", borderRadius: "4px 0 0 0" }} />
          <div style={{ position: "absolute", top: 20, right: 20, width: 32, height: 32, borderTop: "2px solid #5a7aff", borderRight: "2px solid #5a7aff", borderRadius: "0 4px 0 0" }} />
          <div style={{ position: "absolute", bottom: 20, left: 20, width: 32, height: 32, borderBottom: "2px solid #5a7aff", borderLeft: "2px solid #5a7aff", borderRadius: "0 0 0 4px" }} />
          <div style={{ position: "absolute", bottom: 20, right: 20, width: 32, height: 32, borderBottom: "2px solid #5a7aff", borderRight: "2px solid #5a7aff", borderRadius: "0 0 4px 0" }} />

          {/* Logo */}
          <div style={{ fontSize: 28, fontWeight: 700, color: "#5a7aff", letterSpacing: "-0.5px", marginBottom: 8 }}>◆ LMS</div>

          {/* Certificate label */}
          <div style={{ fontSize: 10, letterSpacing: "3px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 40 }}>
            Certificate of Completion
          </div>

          {/* Divider */}
          <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, #2a3347, transparent)", margin: "0 auto 40px" }} />

          <p style={{ fontSize: 14, color: "#4a5568", marginBottom: 16, letterSpacing: "0.5px" }}>
            This is to certify that
          </p>

          <h1 style={{ fontSize: 36, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px", marginBottom: 24, fontFamily: "'Playfair Display', serif" }}>
            {learnerName}
          </h1>

          <p style={{ fontSize: 14, color: "#4a5568", marginBottom: 16, letterSpacing: "0.5px" }}>
            has successfully completed
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#c5d0e8", letterSpacing: "-0.3px", marginBottom: 12, lineHeight: 1.4 }}>
            {courseTitle}
          </h2>

          {score != null && (
            <div style={{ display: "inline-block", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, padding: "6px 18px", marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: "#4ade80", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500 }}>
                Score: {Math.round(score)}%
              </span>
            </div>
          )}

          <p style={{ fontSize: 13, color: "#3a4a68", marginTop: 8 }}>
            on {completionDate}
          </p>

          {/* Divider */}
          <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, #2a3347, transparent)", margin: "40px auto 0" }} />
        </div>
      </div>
    </div>
  );
}
