"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

interface CatalogCourse {
  id: string;
  packageId: string;
  title: string;
  entryPoint: string;
  version: string;
  fileCount: number;
  publishedAt: string;
}

export default function ScormPlayer({
  course,
  scormUrl,
}: {
  course: CatalogCourse;
  scormUrl: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const scriptInjected = useRef(false);

  // Inject the SCORM runtime API onto window before the iframe loads
  useEffect(() => {
    if (scriptInjected.current) return;
    scriptInjected.current = true;

    const src =
      course.version === "2004"
        ? "/scorm-runtime/scorm2004.min.js"
        : "/scorm-runtime/scorm12.min.js";

    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      if (course.version === "2004") {
        // scorm2004.min.js sets window.Scorm2004API
        (window as unknown as Record<string, unknown>)["API_1484_11"] =
          new (window as unknown as { Scorm2004API: new (cfg: object) => unknown })
            .Scorm2004API({ autocommit: true, autocommitSeconds: 10 });
      } else {
        // scorm12.min.js sets window.Scorm12API
        (window as unknown as Record<string, unknown>)["API"] =
          new (window as unknown as { Scorm12API: new (cfg: object) => unknown })
            .Scorm12API({ autocommit: true, autocommitSeconds: 10 });
      }
      setApiReady(true);
    };
    script.onerror = () => {
      // Still allow the iframe to load even if the API fails
      console.warn("[scorm-player] SCORM runtime script failed to load");
      setApiReady(true);
    };
    document.head.appendChild(script);
  }, [course.version]);

  const publishedDate = new Date(course.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0b0f",
      fontFamily: "'IBM Plex Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar */}
      <header style={{
        borderBottom: "1px solid #13161f",
        padding: "0 24px",
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0c0e14",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/catalog" style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#4a5568",
            textDecoration: "none",
            fontSize: 13,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#c5d0e8")}
          onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11 7H3M7 11l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Catalog
          </Link>
          <span style={{ color: "#1e2433", fontSize: 12 }}>›</span>
          <span style={{ fontSize: 13, color: "#7a90bc", fontWeight: 500 }}>
            {course.title}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            padding: "3px 8px",
            borderRadius: 3,
            background: "rgba(90,122,255,0.1)",
            border: "1px solid rgba(90,122,255,0.2)",
            color: "#8099ff",
            letterSpacing: "0.5px",
          }}>
            SCORM {course.version}
          </span>
          <span style={{ fontSize: 12, color: "#3a4a68" }}>
            Published {publishedDate}
          </span>
        </div>
      </header>

      {/* Player area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Loading overlay — shown until API is ready AND iframe has loaded */}
        {(!apiReady || !loaded) && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "#0a0b0f",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            zIndex: 5,
          }}>
            <div style={{
              width: 40,
              height: 40,
              border: "3px solid #1e2433",
              borderTopColor: "#5a7aff",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }} />
            <p style={{ color: "#4a5568", fontSize: 13 }}>
              {!apiReady ? "Initialising SCORM runtime…" : "Loading course…"}
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Only render iframe once API is on window */}
        {apiReady && (
          <iframe
            src={scormUrl}
            title={course.title}
            onLoad={() => setLoaded(true)}
            style={{
              flex: 1,
              width: "100%",
              border: "none",
              minHeight: "calc(100vh - 52px)",
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
}
