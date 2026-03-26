"use client";

import Link from "next/link";

interface Props {
  enrollmentId: string;
  learnerName: string;
  courseTitle: string;
  completedAt: string;
  score: number | null;
}

export default function CertificatePage({ enrollmentId, learnerName, courseTitle, completedAt, score }: Props) {
  const completionDate = new Date(completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html, body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .cert-wrapper {
            min-height: 100vh !important;
            background: white !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .cert-card {
            width: 277mm !important;
            min-height: 190mm !important;
            border: 3px solid #1e2433 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            background: white !important;
          }
          .cert-bg { background: white !important; }
          .cert-title { color: #1a1a2e !important; }
          .cert-name { color: #1a1a2e !important; }
          .cert-course { color: #2d3748 !important; }
          .cert-muted { color: #64748b !important; }
          .cert-accent { color: #4a5568 !important; }
          .cert-score { background: #f0fdf4 !important; border-color: #bbf7d0 !important; color: #15803d !important; }
          .cert-corner { border-color: #334155 !important; }
          .cert-divider { background: #e2e8f0 !important; }
          .cert-logo { color: #334155 !important; }
          .cert-serial { color: #94a3b8 !important; }
        }
      `}</style>

      {/* Navigation bar — hidden on print */}
      <nav className="no-print" style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
          <Link href="/dashboard" style={{ color: "#4a5568", fontSize: 13, textDecoration: "none" }}>← My Dashboard</Link>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{ background: "#5a7aff", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 5, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", alignItems: "center", gap: 7 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5V1h8v4M3 10H1V6h12v4h-2M3 8h8v5H3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            Download PDF
          </button>
        </div>
      </nav>

      {/* Hint text — hidden on print */}
      <div className="no-print" style={{ background: "rgba(90,122,255,0.06)", borderBottom: "1px solid rgba(90,122,255,0.1)", padding: "10px 40px", display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#5a7aff" strokeWidth="1.3"/><path d="M7 6v4M7 4.5v.5" stroke="#5a7aff" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 12, color: "#5a7aff" }}>Click <strong>Download PDF</strong> → in the print dialog, choose <strong>Save as PDF</strong> → set layout to <strong>Landscape</strong> for best results.</span>
      </div>

      {/* Certificate area */}
      <div className="cert-wrapper" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div
          className="cert-card cert-bg"
          style={{
            background: "linear-gradient(135deg, #0c0e14 0%, #111827 100%)",
            border: "1px solid #2a3347",
            borderRadius: 12,
            width: "100%",
            maxWidth: 820,
            padding: "56px 72px",
            textAlign: "center",
            position: "relative",
            boxShadow: "0 32px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Decorative background gradient blobs */}
          <div style={{ position: "absolute", top: -60, left: -60, width: 200, height: 200, background: "radial-gradient(circle, rgba(90,122,255,0.12) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -40, right: -40, width: 180, height: 180, background: "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

          {/* Corner accents */}
          {[
            { top: 20, left: 20, borderTop: "2px solid #5a7aff", borderLeft: "2px solid #5a7aff", borderRadius: "4px 0 0 0" },
            { top: 20, right: 20, borderTop: "2px solid #5a7aff", borderRight: "2px solid #5a7aff", borderRadius: "0 4px 0 0" },
            { bottom: 20, left: 20, borderBottom: "2px solid #5a7aff", borderLeft: "2px solid #5a7aff", borderRadius: "0 0 0 4px" },
            { bottom: 20, right: 20, borderBottom: "2px solid #5a7aff", borderRight: "2px solid #5a7aff", borderRadius: "0 0 4px 0" },
          ].map((s, i) => (
            <div key={i} className="cert-corner" style={{ position: "absolute", width: 28, height: 28, ...s }} />
          ))}

          {/* Logo */}
          <div className="cert-logo" style={{ fontSize: 22, fontWeight: 700, color: "#5a7aff", letterSpacing: "-0.5px", marginBottom: 6 }}>◆ LMS</div>

          {/* Label */}
          <div className="cert-accent" style={{ fontSize: 10, letterSpacing: "3.5px", textTransform: "uppercase", color: "#7a90bc", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 36 }}>
            Certificate of Completion
          </div>

          <div className="cert-divider" style={{ width: 64, height: 1, background: "linear-gradient(90deg, transparent, #3a4a68, transparent)", margin: "0 auto 36px" }} />

          <p className="cert-muted" style={{ fontSize: 13, color: "#4a5568", marginBottom: 14, letterSpacing: "0.8px", textTransform: "uppercase" }}>
            This certifies that
          </p>

          <h1 className="cert-name" style={{ fontSize: 42, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-1px", marginBottom: 20, fontFamily: "'Playfair Display', serif", lineHeight: 1.2 }}>
            {learnerName}
          </h1>

          <p className="cert-muted" style={{ fontSize: 13, color: "#4a5568", marginBottom: 14, letterSpacing: "0.8px", textTransform: "uppercase" }}>
            has successfully completed
          </p>

          <h2 className="cert-course" style={{ fontSize: 24, fontWeight: 600, color: "#c5d0e8", letterSpacing: "-0.3px", marginBottom: 16, lineHeight: 1.4, fontFamily: "'IBM Plex Sans', sans-serif", maxWidth: 500, margin: "0 auto 20px" }}>
            {courseTitle}
          </h2>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            {score != null && (
              <div className="cert-score" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 6, padding: "6px 18px" }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1l1.5 3.2 3.5.5-2.5 2.4.6 3.4-3.1-1.6L3.4 10.5l.6-3.4L1.5 4.7l3.5-.5z" fill="#4ade80"/></svg>
                <span style={{ fontSize: 14, color: "#4ade80", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
                  {Math.round(score)}%
                </span>
              </div>
            )}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(90,122,255,0.08)", border: "1px solid rgba(90,122,255,0.15)", borderRadius: 6, padding: "6px 18px" }}>
              <span style={{ fontSize: 13, color: "#8099ff", fontFamily: "'IBM Plex Mono', monospace" }}>
                {completionDate}
              </span>
            </div>
          </div>

          <div className="cert-divider" style={{ width: 64, height: 1, background: "linear-gradient(90deg, transparent, #3a4a68, transparent)", margin: "32px auto 20px" }} />

          {/* Serial / verification */}
          <div className="cert-serial" style={{ fontSize: 10, color: "#2a3347", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.5px" }}>
            CERT-{enrollmentId.slice(0, 8).toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}
