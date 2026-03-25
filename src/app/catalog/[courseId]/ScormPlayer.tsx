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

type ScormApi = Record<string, (...args: unknown[]) => unknown> & {
  cmi?: Record<string, unknown>;
};

function saveProgress(courseId: string, api: ScormApi, version: "1.2" | "2004") {
  try {
    let score: number | null = null;
    let completed = false;
    let timeSpent: number | null = null;

    const cmi = api.cmi ?? {};

    if (version === "1.2") {
      const rawScore = (cmi as { core?: { score?: { raw?: unknown } } })?.core?.score?.raw;
      score = rawScore != null ? Number(rawScore) : null;
      const status = (cmi as { core?: { lesson_status?: string } })?.core?.lesson_status ?? "";
      completed = status === "passed" || status === "completed";
      const sessionTime = (cmi as { core?: { session_time?: string } })?.core?.session_time ?? "";
      if (sessionTime) {
        const [h, m, s] = sessionTime.split(":").map(Number);
        timeSpent = (h || 0) * 3600 + (m || 0) * 60 + Math.round(s || 0);
      }
    } else {
      const rawScore = (cmi as { score?: { raw?: unknown } })?.score?.raw;
      score = rawScore != null ? Number(rawScore) : null;
      const compStatus = (cmi as { completion_status?: string })?.completion_status ?? "";
      const succStatus = (cmi as { success_status?: string })?.success_status ?? "";
      completed = compStatus === "completed" || succStatus === "passed";
    }

    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        cmi: JSON.stringify(cmi),
        score,
        completed,
        timeSpent,
      }),
    }).catch(() => { /* fire and forget */ });
  } catch { /* non-critical */ }
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

  useEffect(() => {
    if (scriptInjected.current) return;
    scriptInjected.current = true;

    let loadCount = 0;
    const onBothLoaded = () => {
      loadCount++;
      if (loadCount < 2) return;

      const w = window as unknown as Record<string, new (cfg: object) => ScormApi>;

      if (w["Scorm12API"]) {
        const api = new w["Scorm12API"]({});
        // Wrap commit/finish to persist progress
        const origCommit = api["LMSCommit"]?.bind(api);
        const origFinish = api["LMSFinish"]?.bind(api);
        if (origCommit) {
          api["LMSCommit"] = (...args: unknown[]) => {
            const r = origCommit(...args);
            saveProgress(course.id, api, "1.2");
            return r;
          };
        }
        if (origFinish) {
          api["LMSFinish"] = (...args: unknown[]) => {
            const r = origFinish(...args);
            saveProgress(course.id, api, "1.2");
            return r;
          };
        }
        (window as unknown as Record<string, unknown>)["API"] = api;
      }

      if (w["Scorm2004API"]) {
        const api = new w["Scorm2004API"]({});
        const origCommit = api["Commit"]?.bind(api);
        const origTerminate = api["Terminate"]?.bind(api);
        if (origCommit) {
          api["Commit"] = (...args: unknown[]) => {
            const r = origCommit(...args);
            saveProgress(course.id, api, "2004");
            return r;
          };
        }
        if (origTerminate) {
          api["Terminate"] = (...args: unknown[]) => {
            const r = origTerminate(...args);
            saveProgress(course.id, api, "2004");
            return r;
          };
        }
        (window as unknown as Record<string, unknown>)["API_1484_11"] = api;
      }

      setApiReady(true);
    };

    const onError = () => {
      loadCount++;
      if (loadCount >= 2) {
        console.warn("[scorm-player] One or both SCORM runtime scripts failed to load");
        setApiReady(true);
      }
    };

    for (const src of ["/scorm-runtime/scorm12.min.js", "/scorm-runtime/scorm2004.min.js"]) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = onBothLoaded;
      s.onerror = onError;
      document.head.appendChild(s);
    }
  }, [course.id]);

  const publishedDate = new Date(course.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <header style={{ borderBottom: "1px solid #13161f", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/catalog" style={{ display: "flex", alignItems: "center", gap: 6, color: "#4a5568", textDecoration: "none", fontSize: 13, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#c5d0e8")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11 7H3M7 11l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Catalog
          </Link>
          <span style={{ color: "#1e2433", fontSize: 12 }}>›</span>
          <span style={{ fontSize: 13, color: "#7a90bc", fontWeight: 500 }}>{course.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 8px", borderRadius: 3, background: "rgba(90,122,255,0.1)", border: "1px solid rgba(90,122,255,0.2)", color: "#8099ff", letterSpacing: "0.5px" }}>
            SCORM {course.version}
          </span>
          <span style={{ fontSize: 12, color: "#3a4a68" }}>Published {publishedDate}</span>
        </div>
      </header>

      {/* Player area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        {(!apiReady || !loaded) && (
          <div style={{ position: "absolute", inset: 0, background: "#0a0b0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 5 }}>
            <div style={{ width: 40, height: 40, border: "3px solid #1e2433", borderTopColor: "#5a7aff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <p style={{ color: "#4a5568", fontSize: 13 }}>{!apiReady ? "Initialising SCORM runtime…" : "Loading course…"}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {apiReady && (
          <iframe
            src={scormUrl}
            title={course.title}
            onLoad={() => setLoaded(true)}
            style={{ flex: 1, width: "100%", border: "none", minHeight: "calc(100vh - 52px)", opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease" }}
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
}
