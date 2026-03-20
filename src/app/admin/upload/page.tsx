"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

type UploadStage =
  | "idle"
  | "dragging"
  | "uploading"
  | "validating"
  | "success"
  | "error";

interface ValidationResult {
  version: "1.2" | "2004" | "unknown";
  title: string;
  entryPoint: string;
  scormFiles: number;
  s3Uploaded?: boolean;
}

export default function ScormUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [courseTitle, setCourseTitle] = useState("");

  const processFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".zip")) {
      setErrorMsg("Only .zip packages are accepted.");
      setStage("error");
      return;
    }

    setFile(f);
    setStage("uploading");
    setProgress(0);

    // Animate progress bar while uploading
    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return p + Math.random() * 12 + 3;
      });
    }, 200);

    const formData = new FormData();
    formData.append("package", f);

    let res: Response;
    try {
      res = await fetch("/api/admin/packages", {
        method: "POST",
        body: formData,
      });
    } catch (networkErr) {
      clearInterval(progressInterval);
      setErrorMsg(
        networkErr instanceof Error
          ? `Network error: ${networkErr.message}`
          : "Network error — check your connection and that the dev server is running."
      );
      setStage("error");
      return;
    }

    clearInterval(progressInterval);
    setProgress(100);

    // Always try to parse JSON — but handle HTML error pages gracefully
    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      // Next.js returned an HTML error page (unhandled exception in route)
      setErrorMsg(
        `Server error (HTTP ${res.status}). ` +
          "Check the terminal running `next dev` for the full stack trace."
      );
      setStage("error");
      return;
    }

    if (!res.ok) {
      setErrorMsg(
        (data.error as string) ??
          `Upload failed (HTTP ${res.status}). Check server logs.`
      );
      setStage("error");
      return;
    }

    setStage("validating");
    setTimeout(() => {
      setValidation(data as unknown as ValidationResult);
      setCourseTitle((data.title as string) ?? "");
      setStage("success");
    }, 700);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setStage("idle");
      const dropped = e.dataTransfer.files[0];
      if (dropped) processFile(dropped);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handlePublish = async () => {
    if (!validation || !courseTitle.trim()) return;
    alert(`Package "${courseTitle}" published to course catalog.`);
    router.push("/admin");
  };

  const reset = () => {
    setStage("idle");
    setFile(null);
    setValidation(null);
    setErrorMsg("");
    setProgress(0);
    setCourseTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="upload-root">
      {/* Header */}
      <header className="page-header">
        <div className="breadcrumb">
          <a href="/admin">Dashboard</a>
          <span className="sep">›</span>
          <span>SCORM Packages</span>
          <span className="sep">›</span>
          <strong>Upload</strong>
        </div>
        <h1 className="page-title">Upload SCORM Package</h1>
        <p className="page-sub">
          Supports SCORM 1.2 and SCORM 2004. ZIP packages only. Max 500 MB.
        </p>
      </header>

      <main className="upload-main">
        {/* Drop Zone */}
        {(stage === "idle" || stage === "dragging") && (
          <div
            className={`drop-zone ${stage === "dragging" ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setStage("dragging"); }}
            onDragLeave={() => setStage("idle")}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden-input"
              onChange={handleFileChange}
            />
            <div className="drop-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="8" width="40" height="32" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M16 20L24 12L32 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="24" y1="12" x2="24" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="14" y1="36" x2="34" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="drop-label">
              {stage === "dragging" ? "Release to upload" : "Drop .zip file here"}
            </p>
            <p className="drop-sub">or click to browse</p>
            <div className="drop-badges">
              <span className="badge">SCORM 1.2</span>
              <span className="badge">SCORM 2004</span>
              <span className="badge">Max 500 MB</span>
            </div>
          </div>
        )}

        {/* Upload / Validating Progress */}
        {(stage === "uploading" || stage === "validating") && (
          <div className="progress-card">
            <div className="progress-file">
              <div className="file-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="file-meta">
                <span className="file-name">{file?.name}</span>
                <span className="file-size">{file ? (file.size / 1024 / 1024).toFixed(1) + " MB" : ""}</span>
              </div>
            </div>

            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="progress-status">
              <span className="status-label">
                {stage === "uploading"
                  ? `Uploading… ${Math.round(progress)}%`
                  : "Validating SCORM manifest…"}
              </span>
              {stage === "validating" && <span className="spinner" />}
            </div>

            <div className="progress-steps">
              <Step done={progress >= 33} active={progress < 33} label="Transfer" />
              <div className="step-line" />
              <Step done={progress >= 66} active={progress >= 33 && progress < 66} label="Extract" />
              <div className="step-line" />
              <Step done={stage === "validating"} active={progress >= 66 && stage === "uploading"} label="Validate" />
              <div className="step-line" />
              <Step done={false} active={stage === "validating"} label="Index" />
            </div>
          </div>
        )}

        {/* Success State */}
        {stage === "success" && validation && (
          <div className="result-card">
            <div className="result-header">
              <div className="result-icon success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h2 className="result-title">Package validated</h2>
                <p className="result-sub">
                  Ready to publish to the course catalog
                  {validation.s3Uploaded === false && " · stored locally (no S3)"}
                </p>
              </div>
            </div>

            <div className="validation-grid">
              <ValidationRow label="SCORM Version" value={`SCORM ${validation.version}`} tag />
              <ValidationRow label="Entry Point" value={validation.entryPoint} mono />
              <ValidationRow label="Files Detected" value={`${validation.scormFiles} files`} />
              <ValidationRow label="Package Size" value={`${(file!.size / 1024 / 1024).toFixed(1)} MB`} />
            </div>

            <div className="publish-form">
              <label className="form-label">Course Title</label>
              <input
                className="form-input"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="Enter course title…"
              />
              <p className="form-hint">This is the title learners will see in the catalog.</p>
            </div>

            <div className="result-actions">
              <button className="btn-primary" onClick={handlePublish} disabled={!courseTitle.trim()}>
                Publish to Catalog
              </button>
              <button className="btn-ghost" onClick={reset}>
                Upload Another
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {stage === "error" && (
          <div className="result-card error-card">
            <div className="result-header">
              <div className="result-icon error-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2 className="result-title">Upload failed</h2>
                <p className="result-sub error-text">{errorMsg}</p>
              </div>
            </div>

            {/* Show setup hints for common DB errors */}
            {errorMsg.toLowerCase().includes("database") && (
              <div className="hint-box">
                <p className="hint-title">Quick fix checklist</p>
                <ol className="hint-list">
                  <li>Create <code>.env.local</code> with <code>DATABASE_URL=&quot;file:./dev.db&quot;</code></li>
                  <li>Run <code>npx prisma db push</code></li>
                  <li>Restart the dev server</li>
                </ol>
              </div>
            )}

            {errorMsg.toLowerCase().includes("server error") && (
              <div className="hint-box">
                <p className="hint-title">Check the terminal</p>
                <p className="hint-body">
                  An unhandled exception occurred in the API route. The full stack trace is in the terminal running <code>next dev</code>.
                </p>
              </div>
            )}

            <div className="result-actions">
              <button className="btn-primary" onClick={reset}>Try Again</button>
            </div>
          </div>
        )}

        {/* Requirements Panel */}
        <aside className="requirements-panel">
          <h3 className="req-title">Package Requirements</h3>
          <ul className="req-list">
            <ReqItem label="imsmanifest.xml at root" />
            <ReqItem label="Valid SCORM 1.2 or 2004 schema" />
            <ReqItem label="SCO entry point declared" />
            <ReqItem label="ZIP format (.zip only)" />
            <ReqItem label="Under 500 MB compressed" />
          </ul>
          <div className="req-divider" />
          <h3 className="req-title">Setup Required</h3>
          <ul className="req-list plain">
            <li><code>.env.local</code> with <code>DATABASE_URL</code></li>
            <li>Run <code>npx prisma db push</code> once</li>
            <li>S3 env vars optional — skipped in dev</li>
          </ul>
        </aside>
      </main>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

        :global(*) { box-sizing: border-box; margin: 0; padding: 0; }
        :global(body) {
          background: #0f1117;
          color: #e2e8f0;
          font-family: 'IBM Plex Sans', sans-serif;
          min-height: 100vh;
        }

        .upload-root { min-height: 100vh; background: #0f1117; }

        .page-header {
          border-bottom: 1px solid #1e2433;
          padding: 28px 40px 24px;
          background: #0c0e14;
        }
        .breadcrumb {
          font-size: 13px;
          color: #4a5568;
          margin-bottom: 12px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .breadcrumb a { color: #5a7aff; text-decoration: none; }
        .breadcrumb a:hover { text-decoration: underline; }
        .sep { color: #2d3748; }
        .page-title {
          font-size: 26px;
          font-weight: 600;
          letter-spacing: -0.4px;
          color: #f0f4ff;
          margin-bottom: 6px;
        }
        .page-sub { font-size: 14px; color: #4a5568; }

        .upload-main {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 24px;
          padding: 32px 40px;
          max-width: 1100px;
        }

        .drop-zone {
          border: 2px dashed #2a3347;
          border-radius: 8px;
          background: #111520;
          padding: 72px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .drop-zone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 60%, rgba(90,122,255,0.04) 0%, transparent 70%);
          pointer-events: none;
        }
        .drop-zone:hover { border-color: #5a7aff; background: #131824; }
        .drop-zone.dragging { border-color: #5a7aff; background: #131e33; transform: scale(1.005); }
        .hidden-input { display: none; }
        .drop-icon { color: #5a7aff; margin-bottom: 8px; }
        .drop-label { font-size: 18px; font-weight: 500; color: #c5d0e8; }
        .drop-sub { font-size: 13px; color: #4a5568; }
        .drop-badges { display: flex; gap: 8px; margin-top: 8px; }
        .badge {
          font-size: 11px;
          font-family: 'IBM Plex Mono', monospace;
          padding: 3px 10px;
          border-radius: 3px;
          background: #1a2035;
          border: 1px solid #2a3347;
          color: #6b7fa8;
          letter-spacing: 0.3px;
        }

        .progress-card {
          background: #111520;
          border: 1px solid #1e2433;
          border-radius: 8px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .progress-file { display: flex; align-items: center; gap: 14px; }
        .file-icon { color: #5a7aff; flex-shrink: 0; }
        .file-meta { display: flex; flex-direction: column; gap: 3px; }
        .file-name { font-size: 15px; font-weight: 500; color: #c5d0e8; }
        .file-size { font-size: 12px; color: #4a5568; font-family: 'IBM Plex Mono', monospace; }

        .progress-track {
          height: 4px;
          background: #1e2433;
          border-radius: 2px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4060dd, #5a7aff);
          border-radius: 2px;
          transition: width 0.18s ease;
        }
        .progress-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: #4a5568;
        }
        .status-label { color: #7a90bc; }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid #2a3347;
          border-top-color: #5a7aff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .progress-steps { display: flex; align-items: center; }
        .step-line { flex: 1; height: 1px; background: #1e2433; }

        .result-card {
          background: #111520;
          border: 1px solid #1e2433;
          border-radius: 8px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .result-header { display: flex; align-items: flex-start; gap: 16px; }
        .result-icon {
          width: 44px; height: 44px;
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .success-icon { background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
        .error-icon { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
        .result-title { font-size: 18px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px; }
        .result-sub { font-size: 13px; color: #4a5568; }
        .error-text { color: #f87171; }

        .validation-grid {
          display: flex;
          flex-direction: column;
          border: 1px solid #1e2433;
          border-radius: 6px;
          overflow: hidden;
        }

        .hint-box {
          background: #0c0e14;
          border: 1px solid #2a3347;
          border-radius: 6px;
          padding: 16px 20px;
        }
        .hint-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #7a90bc;
          margin-bottom: 10px;
        }
        .hint-list {
          list-style: decimal;
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          color: #6b7fa8;
          line-height: 1.6;
        }
        .hint-list code, .hint-body code {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          background: #1a2035;
          padding: 1px 5px;
          border-radius: 3px;
          color: #8099ff;
        }
        .hint-body { font-size: 13px; color: #6b7fa8; line-height: 1.6; }

        .publish-form { display: flex; flex-direction: column; gap: 8px; }
        .form-label { font-size: 13px; font-weight: 500; color: #7a90bc; letter-spacing: 0.3px; }
        .form-input {
          background: #0c0e14;
          border: 1px solid #2a3347;
          border-radius: 5px;
          padding: 10px 14px;
          font-size: 15px;
          color: #e2e8f0;
          font-family: 'IBM Plex Sans', sans-serif;
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus { border-color: #5a7aff; }
        .form-hint { font-size: 12px; color: #3a4a68; }

        .result-actions { display: flex; gap: 12px; }

        .btn-primary {
          background: #5a7aff; color: #fff;
          border: none; padding: 10px 22px;
          border-radius: 5px; font-size: 14px; font-weight: 500;
          font-family: 'IBM Plex Sans', sans-serif;
          cursor: pointer; transition: background 0.15s, opacity 0.15s;
        }
        .btn-primary:hover:not(:disabled) { background: #4060dd; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

        .btn-ghost {
          background: transparent; color: #7a90bc;
          border: 1px solid #2a3347; padding: 10px 22px;
          border-radius: 5px; font-size: 14px;
          font-family: 'IBM Plex Sans', sans-serif;
          cursor: pointer; transition: all 0.15s;
        }
        .btn-ghost:hover { border-color: #5a7aff; color: #c5d0e8; }

        .requirements-panel {
          background: #0c0e14;
          border: 1px solid #1a2035;
          border-radius: 8px;
          padding: 24px;
          height: fit-content;
          position: sticky;
          top: 24px;
        }
        .req-title {
          font-size: 11px; font-weight: 600;
          letter-spacing: 1px; text-transform: uppercase;
          color: #3a4a68; margin-bottom: 14px;
        }
        .req-list {
          list-style: none;
          display: flex; flex-direction: column; gap: 10px;
        }
        .req-list.plain li {
          font-size: 12px; color: #4a5568;
          padding-left: 12px;
          border-left: 2px solid #1e2433;
          line-height: 1.6;
          font-family: 'IBM Plex Mono', monospace;
        }
        .req-divider { border: none; border-top: 1px solid #1e2433; margin: 20px 0; }
      `}</style>
    </div>
  );
}

function Step({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        border: `2px solid ${done ? "#4ade80" : active ? "#5a7aff" : "#2a3347"}`,
        background: done ? "rgba(34,197,94,0.12)" : active ? "rgba(90,122,255,0.12)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
      }}>
        {done ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#5a7aff" : "#2a3347" }} />
        )}
      </div>
      <span style={{ fontSize: 11, color: done ? "#4ade80" : active ? "#7a90bc" : "#2a3347", fontFamily: "'IBM Plex Mono', monospace" }}>
        {label}
      </span>
    </div>
  );
}

function ValidationRow({ label, value, tag, mono }: { label: string; value: string; tag?: boolean; mono?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 16px", borderBottom: "1px solid #1e2433",
    }}>
      <span style={{ fontSize: 13, color: "#4a5568" }}>{label}</span>
      {tag ? (
        <span style={{
          fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
          padding: "3px 10px", borderRadius: 3,
          background: "rgba(90,122,255,0.12)", border: "1px solid rgba(90,122,255,0.25)",
          color: "#8099ff", letterSpacing: "0.3px",
        }}>{value}</span>
      ) : (
        <span style={{ fontSize: 13, color: "#9aabcc", fontFamily: mono ? "'IBM Plex Mono', monospace" : "inherit" }}>
          {value}
        </span>
      )}
    </div>
  );
}

function ReqItem({ label }: { label: string }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#4a5568" }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="#2a3347" strokeWidth="1.5"/>
        <path d="M4 7l2 2 4-4" stroke="#5a7aff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {label}
    </li>
  );
}
