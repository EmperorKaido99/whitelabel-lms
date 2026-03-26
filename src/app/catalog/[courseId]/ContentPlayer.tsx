"use client";

/**
 * Renders a non-SCORM module based on its type.
 *
 * Supported types:
 *   video  — content.url (YouTube/Vimeo embed or direct video URL)
 *   pdf    — content.url (direct PDF URL)
 *   html   — content.html (raw HTML string rendered in a sandboxed iframe)
 */

interface ModuleContent {
  url?: string;
  html?: string;
  title?: string;
}

function parseContent(raw: string): ModuleContent {
  try { return JSON.parse(raw); } catch { return {}; }
}

function isYouTube(url: string) { return /youtube\.com|youtu\.be/.test(url); }
function isVimeo(url: string)   { return /vimeo\.com/.test(url); }

function toEmbedUrl(url: string): string {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
  return url;
}

export default function ContentPlayer({ type, contentJson, title }: { type: string; contentJson: string; title: string }) {
  const content = parseContent(contentJson);
  const frameH = "calc(100vh - 88px)";

  if (type === "video") {
    const url = content.url ?? "";
    if (!url) return <Empty label="No video URL configured for this module." />;

    if (isYouTube(url) || isVimeo(url)) {
      return (
        <iframe
          src={toEmbedUrl(url)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          style={{ flex: 1, width: "100%", border: "none", minHeight: frameH }}
        />
      );
    }

    // Direct video file
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", minHeight: frameH }}>
        <video
          src={url}
          controls
          style={{ maxWidth: "100%", maxHeight: "100%", width: "100%" }}
          title={title}
        />
      </div>
    );
  }

  if (type === "pdf") {
    const url = content.url ?? "";
    if (!url) return <Empty label="No PDF URL configured for this module." />;
    return (
      <iframe
        src={url}
        title={title}
        style={{ flex: 1, width: "100%", border: "none", minHeight: frameH }}
      />
    );
  }

  if (type === "html") {
    const html = content.html ?? "";
    if (!html) return <Empty label="No content configured for this module." />;
    // Use srcdoc so the HTML is sandboxed inside the iframe
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:32px;line-height:1.6;color:#1a202c;}</style></head><body>${html}</body></html>`;
    return (
      <iframe
        srcDoc={doc}
        sandbox="allow-same-origin allow-scripts"
        title={title}
        style={{ flex: 1, width: "100%", border: "none", minHeight: frameH, background: "#fff" }}
      />
    );
  }

  return <Empty label={`Unknown module type: ${type}`} />;
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5568", fontSize: 14, padding: 40 }}>
      {label}
    </div>
  );
}
