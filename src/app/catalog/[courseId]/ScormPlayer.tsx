"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import ContentPlayer from "./ContentPlayer";

interface CatalogCourse {
  id: string;
  packageId: string;
  title: string;
  entryPoint: string;
  version: string;
  fileCount: number;
  publishedAt: string;
}

interface CourseModule {
  id: string;
  order: number;
  type: string;
  content: string; // JSON: { packageId, entryPoint, version, title }
}

interface ModuleContent {
  packageId?: string;
  entryPoint?: string;
  version?: string;
  title?: string;
}

type ScormApi = Record<string, (...args: unknown[]) => unknown> & {
  cmi?: Record<string, unknown>;
  loadFromJSON?: (json: Record<string, unknown>, CMIElement?: string) => void;
};

function parseModuleContent(raw: string): ModuleContent {
  try { return JSON.parse(raw); } catch { return {}; }
}

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
  modules = [],
}: {
  course: CatalogCourse;
  scormUrl: string;
  modules?: CourseModule[];
}) {
  const multiModule = modules.length > 1;

  // Active module index (only relevant when multiModule)
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const activeModule = multiModule ? modules[activeModuleIdx] : null;
  const activeContent = activeModule ? parseModuleContent(activeModule.content) : null;

  // Derive the actual SCORM URL: use module's package if multi-module, otherwise fall back to course default
  const activeScormUrl = activeContent?.packageId && activeContent?.entryPoint
    ? `/scorm/${activeContent.packageId}/${activeContent.entryPoint}`
    : scormUrl;

  const [loaded, setLoaded] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [resumed, setResumed] = useState(false);
  const scriptInjected = useRef(false);
  // Track which moduleIdx the current API was initialised for
  const apiModuleIdx = useRef(-1);

  const initScormApis = useCallback((savedCmi: Record<string, unknown> | null) => {
    let loadCount = 0;
    const onBothLoaded = () => {
      loadCount++;
      if (loadCount < 2) return;

      const w = window as unknown as Record<string, new (cfg: object) => ScormApi>;

      if (w["Scorm12API"]) {
        const api = new w["Scorm12API"]({});
        if (savedCmi && typeof api.loadFromJSON === "function") {
          try { api.loadFromJSON(savedCmi, ""); } catch { /* non-critical */ }
        }
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
        if (savedCmi && typeof api.loadFromJSON === "function") {
          try { api.loadFromJSON(savedCmi, ""); } catch { /* non-critical */ }
        }
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

  // Initial load — fetch saved progress, then boot the SCORM runtime
  useEffect(() => {
    if (scriptInjected.current) return;
    scriptInjected.current = true;
    apiModuleIdx.current = activeModuleIdx;

    fetch(`/api/progress?courseId=${encodeURIComponent(course.id)}`)
      .then(r => r.json())
      .then((data: unknown) => {
        const record = Array.isArray(data) ? data[0] : data;
        let savedCmi: Record<string, unknown> | null = null;
        if (record && typeof record === "object" && "cmi" in record) {
          const raw = (record as { cmi: string }).cmi;
          try {
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
              savedCmi = parsed as Record<string, unknown>;
              setResumed(true);
            }
          } catch { /* ignore malformed CMI */ }
        }
        initScormApis(savedCmi);
      })
      .catch(() => initScormApis(null));
  }, [course.id, initScormApis]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the learner switches modules, reset the player for the new module
  const switchModule = useCallback((idx: number) => {
    if (idx === activeModuleIdx) return;
    setLoaded(false);
    setResumed(false);
    setApiReady(false);
    apiModuleIdx.current = idx;
    setActiveModuleIdx(idx);

    const modContent = parseModuleContent(modules[idx]?.content ?? "{}");
    const targetCourseId = modContent.packageId ?? course.id;

    fetch(`/api/progress?courseId=${encodeURIComponent(targetCourseId)}`)
      .then(r => r.json())
      .then((data: unknown) => {
        const record = Array.isArray(data) ? data[0] : data;
        let savedCmi: Record<string, unknown> | null = null;
        if (record && typeof record === "object" && "cmi" in record) {
          const raw = (record as { cmi: string }).cmi;
          try {
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
              savedCmi = parsed as Record<string, unknown>;
              setResumed(true);
            }
          } catch { /* ignore */ }
        }
        // Re-init the SCORM API instances for the new module
        const w = window as unknown as Record<string, new (cfg: object) => ScormApi>;
        if (w["Scorm12API"]) {
          const api = new w["Scorm12API"]({});
          if (savedCmi && typeof api.loadFromJSON === "function") {
            try { api.loadFromJSON(savedCmi, ""); } catch { /* ok */ }
          }
          const origCommit = api["LMSCommit"]?.bind(api);
          const origFinish = api["LMSFinish"]?.bind(api);
          if (origCommit) api["LMSCommit"] = (...args) => { origCommit(...args); saveProgress(targetCourseId, api, "1.2"); return "true"; };
          if (origFinish) api["LMSFinish"] = (...args) => { origFinish(...args); saveProgress(targetCourseId, api, "1.2"); return "true"; };
          (window as unknown as Record<string, unknown>)["API"] = api;
        }
        if (w["Scorm2004API"]) {
          const api = new w["Scorm2004API"]({});
          if (savedCmi && typeof api.loadFromJSON === "function") {
            try { api.loadFromJSON(savedCmi, ""); } catch { /* ok */ }
          }
          const origCommit = api["Commit"]?.bind(api);
          const origTerminate = api["Terminate"]?.bind(api);
          if (origCommit) api["Commit"] = (...args) => { origCommit(...args); saveProgress(targetCourseId, api, "2004"); return "true"; };
          if (origTerminate) api["Terminate"] = (...args) => { origTerminate(...args); saveProgress(targetCourseId, api, "2004"); return "true"; };
          (window as unknown as Record<string, unknown>)["API_1484_11"] = api;
        }
        setApiReady(true);
      })
      .catch(() => setApiReady(true));
  }, [activeModuleIdx, course.id, modules]);

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
          {multiModule && activeContent?.title && (
            <>
              <span style={{ color: "#1e2433", fontSize: 12 }}>›</span>
              <span style={{ fontSize: 13, color: "#5a7aff" }}>{activeContent.title}</span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {resumed && (
            <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 8px", borderRadius: 3, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", letterSpacing: "0.5px" }}>
              RESUMED
            </span>
          )}
          <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 8px", borderRadius: 3, background: "rgba(90,122,255,0.1)", border: "1px solid rgba(90,122,255,0.2)", color: "#8099ff", letterSpacing: "0.5px" }}>
            SCORM {course.version}
          </span>
          <span style={{ fontSize: 12, color: "#3a4a68" }}>Published {publishedDate}</span>
        </div>
      </header>

      {/* Module tabs (only shown when course has multiple modules) */}
      {multiModule && (
        <div style={{ borderBottom: "1px solid #13161f", background: "#0c0e14", padding: "0 24px", display: "flex", gap: 0, overflowX: "auto", flexShrink: 0 }}>
          {modules.map((mod, i) => {
            const c = parseModuleContent(mod.content);
            const isActive = i === activeModuleIdx;
            return (
              <button
                key={mod.id}
                onClick={() => switchModule(i)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #5a7aff" : "2px solid transparent",
                  color: isActive ? "#c5d0e8" : "#4a5568",
                  padding: "10px 16px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: isActive ? "#5a7aff" : "#3a4a68" }}>
                  {String(mod.order).padStart(2, "0")}
                </span>
                {c.title ?? `Module ${mod.order}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Player area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        {(!apiReady || !loaded) && (
          <div style={{ position: "absolute", inset: 0, background: "#0a0b0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 5 }}>
            <div style={{ width: 40, height: 40, border: "3px solid #1e2433", borderTopColor: "#5a7aff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <p style={{ color: "#4a5568", fontSize: 13 }}>{!apiReady ? "Initialising SCORM runtime…" : "Loading course…"}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {apiReady && (() => {
          const activeType = activeModule?.type ?? "scorm";
          if (activeType !== "scorm") {
            // Non-SCORM module — delegate to ContentPlayer (no SCORM API needed)
            return (
              <div key={activeModuleIdx} style={{ flex: 1, display: "flex", flexDirection: "column", opacity: 1 }}>
                <ContentPlayer
                  type={activeType}
                  contentJson={activeModule?.content ?? "{}"}
                  title={activeContent?.title ?? course.title}
                />
              </div>
            );
          }
          return (
            <iframe
              key={activeModuleIdx}
              src={activeScormUrl}
              title={activeContent?.title ?? course.title}
              onLoad={() => setLoaded(true)}
              style={{ flex: 1, width: "100%", border: "none", minHeight: `calc(100vh - ${multiModule ? 88 : 52}px)`, opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease" }}
              allow="fullscreen"
            />
          );
        })()}
      </div>
    </div>
  );
}
