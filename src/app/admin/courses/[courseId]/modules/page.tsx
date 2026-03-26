"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ModuleContent {
  packageId?: string;
  entryPoint?: string;
  version?: string;
  title?: string;
}

interface CourseModule {
  id: string;
  order: number;
  type: string;
  content: string;
}

function parseContent(raw: string): ModuleContent {
  try { return JSON.parse(raw); } catch { return {}; }
}

export default function CourseModulesPage() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  // Add non-SCORM module form
  const [addType, setAddType] = useState<"video" | "pdf" | "html">("video");
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addHtml, setAddHtml] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/modules`);
      const data = await res.json();
      setModules(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load modules.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const moveModule = async (id: string, direction: "up" | "down") => {
    const idx = modules.findIndex(m => m.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= modules.length) return;

    const updated = [...modules];
    const aOrder = updated[idx].order;
    const bOrder = updated[swapIdx].order;
    updated[idx] = { ...updated[idx], order: bOrder };
    updated[swapIdx] = { ...updated[swapIdx], order: aOrder };
    updated.sort((a, b) => a.order - b.order);
    setModules(updated);

    setSaving(id);
    try {
      await Promise.all([
        fetch(`/api/admin/courses/${courseId}/modules/${updated.find(m => m.id === id)!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: bOrder }),
        }),
        fetch(`/api/admin/courses/${courseId}/modules/${updated.find(m => m.id !== id && m.order === aOrder)?.id ?? modules[swapIdx].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: aOrder }),
        }),
      ]);
    } catch {
      fetchModules(); // revert on failure
    } finally {
      setSaving(null);
    }
  };

  const addModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const content: Record<string, string> = { title: addTitle };
    if (addType === "html") { content.html = addHtml; }
    else { content.url = addUrl; }
    const res = await fetch(`/api/admin/courses/${courseId}/modules`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: addType, content }),
    });
    setAdding(false);
    if (res.ok) {
      setAddTitle(""); setAddUrl(""); setAddHtml(""); setShowAddForm(false);
      fetchModules();
    }
  };

  const deleteModule = async (id: string) => {
    if (!confirm("Remove this module from the course?")) return;
    setSaving(id);
    try {
      await fetch(`/api/admin/courses/${courseId}/modules/${id}`, { method: "DELETE" });
      setModules(prev => prev.filter(m => m.id !== id));
    } catch {
      setError("Failed to delete module.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", gap: 24, background: "#0c0e14" }}>
        <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
        <Link href="/admin" style={{ color: "#4a5568", fontSize: 13, textDecoration: "none" }}>Admin</Link>
        <span style={{ color: "#1e2433", fontSize: 12 }}>›</span>
        <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Course Modules</span>
      </nav>

      <main style={{ padding: "40px", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>
            Course · {courseId.slice(0, 8)}…
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px" }}>Modules</h1>
          <p style={{ fontSize: 13, color: "#4a5568", marginTop: 6 }}>
            Ordered sections within this course. Each SCORM package becomes a module automatically on publish.
          </p>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "12px 16px", fontSize: 13, color: "#f87171", marginBottom: 20 }}>
            {error}
          </div>
        )}

        <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, overflow: "hidden" }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 90px 110px 120px", padding: "10px 20px", borderBottom: "1px solid #13161f", background: "#080a0f" }}>
            {["#", "Module", "Type", "Version", "Actions"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>Loading modules…</div>
          ) : modules.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <p style={{ color: "#4a5568", fontSize: 14, marginBottom: 12 }}>No modules yet.</p>
              <p style={{ color: "#3a4a68", fontSize: 13 }}>
                Publish a SCORM package to this course and a module will be created automatically.{" "}
                <Link href="/admin/scorm/upload" style={{ color: "#5a7aff", textDecoration: "none" }}>Upload a package →</Link>
              </p>
            </div>
          ) : modules.map((mod, i) => {
            const content = parseContent(mod.content);
            const isSaving = saving === mod.id;
            return (
              <div
                key={mod.id}
                style={{ display: "grid", gridTemplateColumns: "48px 1fr 90px 110px 120px", padding: "14px 20px", borderBottom: i < modules.length - 1 ? "1px solid #13161f" : "none", alignItems: "center", opacity: isSaving ? 0.5 : 1, transition: "opacity 0.15s" }}
              >
                {/* Order badge */}
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a2035", border: "1px solid #2a3347", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: "#7a90bc" }}>
                  {mod.order}
                </div>

                {/* Title */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#c5d0e8" }}>
                    {content.title ?? `Module ${mod.order}`}
                  </div>
                  {content.packageId && (
                    <div style={{ fontSize: 11, color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                      {content.packageId.slice(0, 8)}…
                    </div>
                  )}
                </div>

                {/* Type badge */}
                <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 8px", borderRadius: 3, background: "rgba(90,122,255,0.1)", border: "1px solid rgba(90,122,255,0.2)", color: "#8099ff", letterSpacing: "0.5px", width: "fit-content" }}>
                  {mod.type.toUpperCase()}
                </span>

                {/* Version */}
                <span style={{ fontSize: 12, color: "#4a5568", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {content.version ? `SCORM ${content.version}` : "—"}
                </span>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => moveModule(mod.id, "up")}
                    disabled={i === 0 || isSaving}
                    title="Move up"
                    style={{ width: 28, height: 28, borderRadius: 5, background: "#111520", border: "1px solid #2a3347", color: i === 0 ? "#2a3347" : "#7a90bc", cursor: i === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}
                  >↑</button>
                  <button
                    onClick={() => moveModule(mod.id, "down")}
                    disabled={i === modules.length - 1 || isSaving}
                    title="Move down"
                    style={{ width: 28, height: 28, borderRadius: 5, background: "#111520", border: "1px solid #2a3347", color: i === modules.length - 1 ? "#2a3347" : "#7a90bc", cursor: i === modules.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}
                  >↓</button>
                  <button
                    onClick={() => deleteModule(mod.id)}
                    disabled={isSaving}
                    title="Remove module"
                    style={{ width: 28, height: 28, borderRadius: 5, background: "#111520", border: "1px solid #2a3347", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}
                  >×</button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20 }}>
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)} style={{ background: "rgba(90,122,255,0.1)", color: "#8099ff", border: "1px solid rgba(90,122,255,0.2)", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Add Video / PDF / HTML Module
            </button>
          ) : (
            <form onSubmit={addModule} style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#c5d0e8", marginBottom: 4 }}>Add Non-SCORM Module</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ fontSize: 11, color: "#4a5568", display: "block", marginBottom: 5, fontFamily: "'IBM Plex Mono', monospace" }}>TYPE</label>
                  <select value={addType} onChange={e => setAddType(e.target.value as "video" | "pdf" | "html")} style={{ width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 5, padding: "8px 10px", fontSize: 13, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    <option value="video">Video</option>
                    <option value="pdf">PDF</option>
                    <option value="html">HTML / Text</option>
                  </select>
                </div>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <label style={{ fontSize: 11, color: "#4a5568", display: "block", marginBottom: 5, fontFamily: "'IBM Plex Mono', monospace" }}>MODULE TITLE *</label>
                  <input value={addTitle} onChange={e => setAddTitle(e.target.value)} required placeholder="e.g. Introduction Video" style={{ width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 5, padding: "8px 12px", fontSize: 13, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" }} />
                </div>
              </div>
              {addType !== "html" ? (
                <div>
                  <label style={{ fontSize: 11, color: "#4a5568", display: "block", marginBottom: 5, fontFamily: "'IBM Plex Mono', monospace" }}>URL *</label>
                  <input value={addUrl} onChange={e => setAddUrl(e.target.value)} required placeholder={addType === "video" ? "YouTube, Vimeo, or direct .mp4 URL" : "Direct PDF URL"} style={{ width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 5, padding: "8px 12px", fontSize: 13, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" }} />
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: 11, color: "#4a5568", display: "block", marginBottom: 5, fontFamily: "'IBM Plex Mono', monospace" }}>HTML CONTENT *</label>
                  <textarea value={addHtml} onChange={e => setAddHtml(e.target.value)} required rows={6} placeholder="<h2>Welcome</h2><p>Your content here…</p>" style={{ width: "100%", background: "#111520", border: "1px solid #2a3347", borderRadius: 5, padding: "8px 12px", fontSize: 12, color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace", resize: "vertical" }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={adding} style={{ background: "#5a7aff", color: "#fff", border: "none", borderRadius: 5, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: adding ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {adding ? "Adding…" : "Add Module"}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} style={{ background: "none", border: "1px solid #2a3347", color: "#7a90bc", borderRadius: 5, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "#3a4a68" }}>
          SCORM modules are created automatically when a package is published. Add video, PDF, or HTML modules above.
        </div>
      </main>
    </div>
  );
}
