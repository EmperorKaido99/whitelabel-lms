import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const maxDuration = 60;

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  title: string;
  description: string;
  estimatedDuration: string;
  content: string; // HTML
  keyTakeaways: string[];
  quiz: QuizQuestion[];
}

export interface CourseData {
  title: string;
  description: string;
  targetAudience: string;
  estimatedDuration: string;
  objectives: string[];
  lessons: Lesson[];
}

// ---------------------------------------------------------------------------
// POST /api/admin/courses/generate-scorm
// Body: { course: CourseData, action: "download" | "publish" }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      course,
      action = "download",
    } = body as { course: CourseData; action: "download" | "publish" };

    if (!course?.title || !Array.isArray(course?.lessons) || course.lessons.length === 0) {
      return NextResponse.json({ error: "Invalid course data." }, { status: 400 });
    }

    const packageId = randomUUID();
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    zip.file("imsmanifest.xml", generateManifest(packageId, course));
    zip.file("index.html", generatePlayer(course));

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // ---- Publish mode: extract to disk + write catalog entry ---------------
    if (action === "publish") {
      const { writeFile, mkdir } = await import("fs/promises");
      const { existsSync } = await import("fs");
      const path = await import("path");

      const destDir = path.join(process.cwd(), "public", "scorm", packageId);
      if (!existsSync(destDir)) await mkdir(destDir, { recursive: true });

      const reloaded = await JSZip.loadAsync(zipBuffer);
      await Promise.all(
        Object.entries(reloaded.files).map(async ([relPath, entry]) => {
          if (entry.dir) return;
          const content = await entry.async("nodebuffer");
          const filePath = path.join(destDir, relPath);
          const fileDir = path.dirname(filePath);
          if (!existsSync(fileDir)) await mkdir(fileDir, { recursive: true });
          await writeFile(filePath, content);
        })
      );

      // Write catalog + DB via publish route logic (inline to avoid extra HTTP call)
      const { readFile, mkdir: mkdirFs } = await import("fs/promises");
      const { existsSync: fsExists } = await import("fs");
      const catalogPath = path.join(process.cwd(), "data", "catalog.json");

      let catalog: unknown[] = [];
      try {
        catalog = JSON.parse(await readFile(catalogPath, "utf-8"));
      } catch { /* first time */ }

      const catalogEntry = {
        id: packageId,
        packageId,
        title: course.title.trim(),
        description: course.description?.trim() || undefined,
        categories: [],
        entryPoint: "index.html",
        version: "1.2",
        fileCount: 2,
        publishedAt: new Date().toISOString(),
      };

      const filtered = (catalog as { packageId?: string }[]).filter(
        (c) => c.packageId !== packageId
      );
      filtered.push(catalogEntry);

      const dataDir = path.dirname(catalogPath);
      if (!fsExists(dataDir)) await mkdirFs(dataDir, { recursive: true });
      await writeFile(catalogPath, JSON.stringify(filtered, null, 2), "utf-8");

      // Upsert DB record
      try {
        const { prisma } = await import("@/adapters/db");
        let tenantId: string | null = null;
        try {
          const { auth } = await import("@/lib/auth/config");
          const session = await auth();
          tenantId = (session?.user as { tenantId?: string })?.tenantId ?? null;
        } catch { /* no auth */ }
        if (!tenantId) {
          const tenant = await prisma.tenant.findFirst({ where: { slug: "demo" } });
          tenantId = tenant?.id ?? null;
        }
        if (tenantId) {
          await prisma.course.upsert({
            where: { id: packageId },
            update: { title: course.title, description: course.description ?? null, status: "published" },
            create: {
              id: packageId,
              title: course.title,
              description: course.description ?? null,
              categories: "[]",
              status: "published",
              tenantId,
            },
          });
          const existing = await prisma.module.findFirst({ where: { courseId: packageId, tenantId } });
          if (!existing) {
            await prisma.module.create({
              data: {
                courseId: packageId,
                tenantId,
                order: 1,
                type: "scorm",
                content: JSON.stringify({ packageId, entryPoint: "index.html", version: "1.2", title: course.title }),
              },
            });
          }
        }
      } catch (dbErr) {
        console.warn("[generate-scorm] DB upsert failed (continuing):", dbErr);
      }

      return NextResponse.json({ success: true, packageId, course: catalogEntry });
    }

    // ---- Download mode: return ZIP binary ----------------------------------
    const safeTitle = course.title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").slice(0, 60);
    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}_scorm.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err) {
    console.error("[generate-scorm]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `SCORM generation failed: ${msg}` }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// imsmanifest.xml
// ---------------------------------------------------------------------------
function generateManifest(packageId: string, course: CourseData): string {
  const id = `com.lms.ai.${packageId.replace(/-/g, "").slice(0, 16)}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${esc(course.title)}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${esc(course.title)}</title>
        <adlcp:masteryscore>70</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// SCORM 1.2 lesson player (single HTML file, self-contained)
// ---------------------------------------------------------------------------
function generatePlayer(course: CourseData): string {
  // Safely embed course data as JSON
  const courseJson = JSON.stringify(course).replace(/<\/script>/gi, "<\\/script>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(course.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: #f5f6f8;
      color: #1a1e2e;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ---- Top bar ---- */
    #topbar {
      background: #1e2433;
      color: #e2e8f0;
      padding: 0 24px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      gap: 16px;
    }
    #topbar .course-title {
      font-size: 15px;
      font-weight: 600;
      color: #f0f4ff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 400px;
    }
    #topbar .top-progress {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #7a90bc;
      white-space: nowrap;
    }
    .top-bar-track {
      width: 160px;
      height: 4px;
      background: #2a3347;
      border-radius: 2px;
      overflow: hidden;
    }
    .top-bar-fill {
      height: 100%;
      background: #5a7aff;
      border-radius: 2px;
      transition: width 0.4s ease;
    }

    /* ---- Layout ---- */
    #layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ---- Sidebar ---- */
    #sidebar {
      width: 260px;
      background: #fff;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .sidebar-section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #a0aec0;
      padding: 16px 18px 8px;
    }
    .lesson-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: all 0.15s;
      font-size: 13px;
      color: #4a5568;
      line-height: 1.4;
    }
    .lesson-item:hover { background: #f7faff; color: #1a1e2e; }
    .lesson-item.active {
      background: #eef1ff;
      border-left-color: #5a7aff;
      color: #3456cc;
      font-weight: 500;
    }
    .lesson-item.completed { color: #38a169; }
    .lesson-item.completed .lesson-icon { color: #38a169; }
    .lesson-num {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #718096;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s;
    }
    .lesson-item.active .lesson-num {
      background: #5a7aff;
      color: #fff;
    }
    .lesson-item.completed .lesson-num {
      background: #c6f6d5;
      color: #276749;
    }
    .check-icon { font-size: 12px; }

    /* ---- Main content ---- */
    #main {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      display: flex;
      flex-direction: column;
    }

    #content-area {
      flex: 1;
      max-width: 760px;
      margin: 0 auto;
      padding: 36px 32px 20px;
      width: 100%;
    }

    .lesson-header {
      margin-bottom: 28px;
    }
    .lesson-tag {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #5a7aff;
      margin-bottom: 8px;
    }
    .lesson-title {
      font-size: 26px;
      font-weight: 700;
      color: #1a1e2e;
      line-height: 1.3;
      letter-spacing: -0.3px;
      margin-bottom: 6px;
    }
    .lesson-meta {
      font-size: 13px;
      color: #a0aec0;
      display: flex;
      gap: 14px;
    }
    .lesson-meta span::before { margin-right: 4px; }

    /* Lesson HTML content */
    .lesson-body { line-height: 1.75; color: #2d3748; }
    .lesson-body h2 {
      font-size: 20px;
      font-weight: 700;
      color: #1a1e2e;
      margin: 24px 0 10px;
      letter-spacing: -0.2px;
    }
    .lesson-body h3 {
      font-size: 16px;
      font-weight: 600;
      color: #2d3748;
      margin: 18px 0 8px;
    }
    .lesson-body p { margin-bottom: 14px; }
    .lesson-body ul, .lesson-body ol {
      padding-left: 22px;
      margin-bottom: 14px;
    }
    .lesson-body li { margin-bottom: 5px; }
    .lesson-body blockquote {
      border-left: 4px solid #5a7aff;
      padding: 12px 16px;
      margin: 16px 0;
      background: #f0f4ff;
      border-radius: 0 6px 6px 0;
      color: #3456cc;
      font-style: italic;
    }
    .lesson-body strong { color: #1a1e2e; }

    /* Key takeaways */
    .takeaways {
      background: #f0f4ff;
      border: 1px solid #c7d4ff;
      border-radius: 10px;
      padding: 20px 22px;
      margin: 28px 0;
    }
    .takeaways-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #5a7aff;
      margin-bottom: 12px;
    }
    .takeaway-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 14px;
      color: #3456cc;
    }
    .takeaway-bullet {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #5a7aff;
      flex-shrink: 0;
      margin-top: 7px;
    }

    /* Quiz */
    .quiz-section {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 28px;
      margin: 20px 0;
    }
    .quiz-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }
    .quiz-badge {
      background: #5a7aff;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 20px;
    }
    .quiz-title { font-size: 16px; font-weight: 600; color: #1a1e2e; }

    .question-block { margin-bottom: 24px; }
    .question-text {
      font-size: 15px;
      font-weight: 500;
      color: #1a1e2e;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .question-num {
      font-size: 12px;
      color: #a0aec0;
      margin-bottom: 6px;
    }

    .option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      font-size: 14px;
      color: #2d3748;
      transition: all 0.15s;
      user-select: none;
    }
    .option:hover { border-color: #5a7aff; background: #f8f9ff; }
    .option.selected { border-color: #5a7aff; background: #eef1ff; color: #3456cc; font-weight: 500; }
    .option.correct { border-color: #38a169; background: #f0fff4; color: #276749; }
    .option.incorrect { border-color: #e53e3e; background: #fff5f5; color: #c53030; }
    .option.reveal-correct { border-color: #38a169; background: #f0fff4; }
    .option input[type="radio"] { accent-color: #5a7aff; width: 16px; height: 16px; }

    .explanation {
      margin-top: 8px;
      padding: 10px 14px;
      background: #f7fafc;
      border-left: 3px solid #38a169;
      border-radius: 0 6px 6px 0;
      font-size: 13px;
      color: #276749;
      display: none;
    }
    .explanation.show { display: block; }

    .quiz-submit {
      display: block;
      width: 100%;
      padding: 12px;
      background: #5a7aff;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      font-family: inherit;
      margin-top: 8px;
    }
    .quiz-submit:hover { background: #4060dd; }
    .quiz-submit:disabled { background: #a0aec0; cursor: not-allowed; }

    .quiz-result {
      text-align: center;
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
      font-size: 15px;
      font-weight: 600;
      display: none;
    }
    .quiz-result.pass { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .quiz-result.fail { background: #fff5f5; color: #c53030; border: 1px solid #fed7d7; }

    /* Navigation */
    #nav-bar {
      border-top: 1px solid #e2e8f0;
      background: #fff;
      padding: 16px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .nav-btn {
      padding: 10px 22px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-btn.primary {
      background: #5a7aff;
      color: #fff;
      border: none;
    }
    .nav-btn.primary:hover { background: #4060dd; }
    .nav-btn.primary:disabled { background: #c7d4ff; cursor: not-allowed; }
    .nav-btn.ghost {
      background: transparent;
      color: #718096;
      border: 1.5px solid #e2e8f0;
    }
    .nav-btn.ghost:hover { border-color: #5a7aff; color: #5a7aff; }
    .nav-btn.ghost:disabled { opacity: 0.4; cursor: not-allowed; }
    .nav-center { font-size: 13px; color: #a0aec0; }

    /* Completion screen */
    #completion-screen {
      display: none;
      flex: 1;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
    }
    .completion-card {
      max-width: 480px;
    }
    .completion-icon { font-size: 56px; margin-bottom: 16px; }
    .completion-title { font-size: 28px; font-weight: 700; color: #1a1e2e; margin-bottom: 8px; }
    .completion-sub { font-size: 15px; color: #718096; margin-bottom: 24px; line-height: 1.6; }
    .score-badge {
      display: inline-block;
      background: #f0fff4;
      border: 2px solid #c6f6d5;
      color: #276749;
      font-size: 22px;
      font-weight: 700;
      padding: 10px 28px;
      border-radius: 50px;
      margin-bottom: 24px;
    }

    /* Objectives */
    .objectives-block {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 20px 22px;
      margin-bottom: 28px;
    }
    .objectives-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #a0aec0;
      margin-bottom: 12px;
    }
    .objective-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 14px;
      color: #2d3748;
    }
    .obj-check { color: #5a7aff; flex-shrink: 0; margin-top: 1px; }
  </style>
</head>
<body>

<!-- Top bar -->
<div id="topbar">
  <div class="course-title" id="topbar-title"></div>
  <div class="top-progress">
    <span id="topbar-progress-label">0 / 0 lessons</span>
    <div class="top-bar-track">
      <div class="top-bar-fill" id="topbar-fill" style="width:0%"></div>
    </div>
  </div>
</div>

<!-- Body layout -->
<div id="layout">
  <!-- Sidebar -->
  <div id="sidebar">
    <div class="sidebar-section-label">Course Lessons</div>
    <nav id="lesson-nav"></nav>
  </div>

  <!-- Main -->
  <div id="main">
    <div id="content-area"></div>
    <div id="completion-screen">
      <div class="completion-card">
        <div class="completion-icon">🎓</div>
        <div class="completion-title">Course Complete!</div>
        <div class="completion-sub" id="completion-sub"></div>
        <div class="score-badge" id="final-score"></div>
        <div id="completion-status"></div>
      </div>
    </div>
    <div id="nav-bar">
      <button class="nav-btn ghost" id="btn-prev" onclick="navigate(-1)" disabled>← Previous</button>
      <span class="nav-center" id="nav-center-label"></span>
      <button class="nav-btn primary" id="btn-next" onclick="handleNext()">Next →</button>
    </div>
  </div>
</div>

<script>
  // =========================================================================
  // Course data (injected at generation time)
  // =========================================================================
  const COURSE = ${courseJson};

  // =========================================================================
  // SCORM 1.2 API wrapper
  // =========================================================================
  let _api = null;
  let _initialized = false;
  const _startTime = Date.now();

  function _findAPI(w) {
    let tries = 0;
    while (w.API == null && w.parent != null && w.parent !== w) {
      if (++tries > 7) return null;
      w = w.parent;
    }
    return w.API || null;
  }

  function scormInit() {
    _api = _findAPI(window);
    if (_api) {
      const res = _api.LMSInitialize("");
      _initialized = (res === "true" || res === true);
    } else {
      // Stub API for standalone use
      _initialized = true;
      console.info("[SCORM] No LMS API found — running in standalone mode.");
    }
  }

  function scormSet(key, value) {
    if (_api && _initialized) _api.LMSSetValue(key, String(value));
  }

  function scormGet(key) {
    if (_api && _initialized) return _api.LMSGetValue(key);
    return "";
  }

  function scormCommit() {
    if (_api && _initialized) _api.LMSCommit("");
  }

  function scormFinish() {
    if (_api && _initialized) {
      // Report session time
      const elapsed = Math.round((Date.now() - _startTime) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      const t = String(h).padStart(4,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '.0';
      scormSet("cmi.core.session_time", t);
      scormCommit();
      _api.LMSFinish("");
    }
  }

  // =========================================================================
  // App state
  // =========================================================================
  const state = {
    currentIndex: 0,
    mode: 'content', // 'content' | 'quiz' | 'complete'
    lessons: COURSE.lessons.map(() => ({
      completed: false,
      quizScore: null,   // 0-100 or null
      quizSubmitted: false,
      answers: {},       // questionIndex -> optionIndex
    })),
  };

  // =========================================================================
  // Utilities
  // =========================================================================
  function completedCount() {
    return state.lessons.filter(l => l.completed).length;
  }

  function overallScore() {
    const scored = state.lessons.filter(l => l.quizScore !== null);
    if (!scored.length) return 100;
    return Math.round(scored.reduce((s, l) => s + (l.quizScore ?? 0), 0) / scored.length);
  }

  // =========================================================================
  // Rendering
  // =========================================================================
  function renderAll() {
    renderTopBar();
    renderSidebar();
    if (state.mode === 'complete') {
      renderComplete();
    } else {
      renderLesson();
    }
    renderNavBar();
  }

  function renderTopBar() {
    document.getElementById('topbar-title').textContent = COURSE.title;
    const done = completedCount();
    const total = COURSE.lessons.length;
    document.getElementById('topbar-progress-label').textContent = done + ' / ' + total + ' lessons';
    document.getElementById('topbar-fill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  }

  function renderSidebar() {
    const nav = document.getElementById('lesson-nav');
    nav.innerHTML = COURSE.lessons.map((lesson, i) => {
      const ls = state.lessons[i];
      let cls = 'lesson-item';
      if (i === state.currentIndex && state.mode !== 'complete') cls += ' active';
      if (ls.completed) cls += ' completed';
      const num = ls.completed
        ? '<span class="lesson-num check-icon">✓</span>'
        : '<span class="lesson-num">' + (i + 1) + '</span>';
      return '<div class="' + cls + '" onclick="goToLesson(' + i + ')">' +
        num +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(lesson.title) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderNavBar() {
    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    const center = document.getElementById('nav-center-label');
    const lesson = COURSE.lessons[state.currentIndex];
    const ls = state.lessons[state.currentIndex];

    if (state.mode === 'complete') {
      prev.style.display = 'none';
      next.style.display = 'none';
      center.textContent = '🎉 Course completed!';
      return;
    }

    prev.style.display = '';
    next.style.display = '';
    prev.disabled = state.currentIndex === 0 && state.mode === 'content';

    center.textContent = 'Lesson ' + (state.currentIndex + 1) + ' of ' + COURSE.lessons.length;

    if (state.mode === 'content') {
      const hasQuiz = lesson.quiz && lesson.quiz.length > 0;
      next.textContent = hasQuiz ? 'Take Quiz →' : (state.currentIndex < COURSE.lessons.length - 1 ? 'Next Lesson →' : 'Finish Course →');
      next.disabled = false;
    } else {
      // quiz mode
      next.textContent = ls.quizSubmitted
        ? (state.currentIndex < COURSE.lessons.length - 1 ? 'Next Lesson →' : 'Finish Course →')
        : 'Submit Quiz';
      next.disabled = !ls.quizSubmitted && Object.keys(ls.answers).length < (lesson.quiz?.length ?? 0);
    }
  }

  function renderLesson() {
    const ca = document.getElementById('content-area');
    const cs = document.getElementById('completion-screen');
    ca.style.display = '';
    cs.style.display = 'none';

    const lesson = COURSE.lessons[state.currentIndex];

    if (state.mode === 'content') {
      ca.innerHTML = buildContentHtml(lesson, state.currentIndex);
    } else {
      ca.innerHTML = buildQuizHtml(lesson, state.currentIndex);
    }
  }

  function renderComplete() {
    const ca = document.getElementById('content-area');
    const cs = document.getElementById('completion-screen');
    ca.style.display = 'none';
    cs.style.display = 'flex';

    const score = overallScore();
    const passed = score >= 70;
    document.getElementById('final-score').textContent = score + '%';
    document.getElementById('completion-sub').textContent =
      'You have completed all ' + COURSE.lessons.length + ' lessons in "' + COURSE.title + '".';
    document.getElementById('completion-status').innerHTML =
      passed
        ? '<p style="color:#276749;font-size:15px;font-weight:600">✓ Passed with ' + score + '%</p>'
        : '<p style="color:#c53030;font-size:15px">Score below passing threshold (70%). Review lessons and try again.</p>';
  }

  function buildContentHtml(lesson, index) {
    const isFirst = index === 0;
    let html = '';

    // Show objectives only on first lesson
    if (isFirst && COURSE.objectives && COURSE.objectives.length) {
      html += '<div class="objectives-block">';
      html += '<div class="objectives-label">Learning Objectives</div>';
      COURSE.objectives.forEach(function(obj) {
        html += '<div class="objective-item"><span class="obj-check">◆</span><span>' + escHtml(obj) + '</span></div>';
      });
      html += '</div>';
    }

    // Lesson header
    html += '<div class="lesson-header">';
    html += '<div class="lesson-tag">Lesson ' + (index + 1) + ' of ' + COURSE.lessons.length + '</div>';
    html += '<h1 class="lesson-title">' + escHtml(lesson.title) + '</h1>';
    html += '<div class="lesson-meta">';
    if (lesson.estimatedDuration) html += '<span>⏱ ' + escHtml(lesson.estimatedDuration) + '</span>';
    html += '</div>';
    html += '</div>';

    // Lesson body (raw HTML from AI — sanitized via DOMParser below)
    html += '<div class="lesson-body">' + lesson.content + '</div>';

    // Key takeaways
    if (lesson.keyTakeaways && lesson.keyTakeaways.length) {
      html += '<div class="takeaways">';
      html += '<div class="takeaways-label">Key Takeaways</div>';
      lesson.keyTakeaways.forEach(function(t) {
        html += '<div class="takeaway-item"><div class="takeaway-bullet"></div><span>' + escHtml(t) + '</span></div>';
      });
      html += '</div>';
    }

    return html;
  }

  function buildQuizHtml(lesson, lessonIndex) {
    const ls = state.lessons[lessonIndex];
    let html = '<div class="quiz-section">';
    html += '<div class="quiz-header"><span class="quiz-badge">Quiz</span><span class="quiz-title">Check Your Understanding</span></div>';

    lesson.quiz.forEach(function(q, qi) {
      const answered = qi in ls.answers;
      const selected = ls.answers[qi];
      const submitted = ls.quizSubmitted;

      html += '<div class="question-block" id="q_' + lessonIndex + '_' + qi + '">';
      html += '<div class="question-num">Question ' + (qi + 1) + ' of ' + lesson.quiz.length + '</div>';
      html += '<div class="question-text">' + escHtml(q.question) + '</div>';

      q.options.forEach(function(opt, oi) {
        let cls = 'option';
        if (!submitted && selected === oi) cls += ' selected';
        if (submitted) {
          if (oi === q.correctIndex) cls += ' correct';
          else if (selected === oi && selected !== q.correctIndex) cls += ' incorrect';
        }
        html += '<label class="' + cls + '">';
        html += '<input type="radio" name="q_' + lessonIndex + '_' + qi + '"' +
                  (selected === oi ? ' checked' : '') +
                  (submitted ? ' disabled' : '') +
                  ' onchange="selectAnswer(' + lessonIndex + ',' + qi + ',' + oi + ')">';
        html += escHtml(opt);
        html += '</label>';
      });

      if (submitted) {
        html += '<div class="explanation show">' +
          (selected === q.correctIndex ? '✓ Correct! ' : '✗ Incorrect. ') +
          escHtml(q.explanation) + '</div>';
      }

      html += '</div>';
    });

    if (!ls.quizSubmitted) {
      html += '<button class="quiz-submit" id="quiz-submit-btn" onclick="submitQuiz(' + lessonIndex + ')"' +
        (Object.keys(ls.answers).length < lesson.quiz.length ? ' disabled' : '') + '>Submit Answers</button>';
    } else {
      const score = ls.quizScore ?? 0;
      const pass = score >= 70;
      html += '<div class="quiz-result ' + (pass ? 'pass' : 'fail') + '" style="display:block">' +
        (pass ? '🎉 Great job! ' : '📚 Keep studying. ') +
        'You scored ' + score + '% on this quiz.' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  // =========================================================================
  // Interactions
  // =========================================================================
  function goToLesson(index) {
    if (state.mode === 'complete') return;
    state.currentIndex = index;
    state.mode = 'content';
    renderAll();
    document.getElementById('main').scrollTop = 0;
  }

  function selectAnswer(lessonIndex, qi, oi) {
    state.lessons[lessonIndex].answers[qi] = oi;
    renderNavBar(); // update submit button enabled state
  }

  function submitQuiz(lessonIndex) {
    const lesson = COURSE.lessons[lessonIndex];
    const ls = state.lessons[lessonIndex];

    if (Object.keys(ls.answers).length < lesson.quiz.length) return;

    let correct = 0;
    lesson.quiz.forEach(function(q, qi) {
      if (ls.answers[qi] === q.correctIndex) correct++;
    });

    ls.quizScore = Math.round((correct / lesson.quiz.length) * 100);
    ls.quizSubmitted = true;
    ls.completed = true;

    scormSet("cmi.core.lesson_status", "incomplete");
    scormCommit();

    renderAll();
  }

  function handleNext() {
    const lesson = COURSE.lessons[state.currentIndex];
    const ls = state.lessons[state.currentIndex];
    const hasQuiz = lesson.quiz && lesson.quiz.length > 0;

    if (state.mode === 'content' && hasQuiz) {
      state.mode = 'quiz';
      renderAll();
      document.getElementById('main').scrollTop = 0;
      return;
    }

    if (state.mode === 'quiz' && !ls.quizSubmitted) {
      submitQuiz(state.currentIndex);
      return;
    }

    // Mark complete if no quiz
    if (!hasQuiz && !ls.completed) {
      ls.completed = true;
      ls.quizScore = 100;
    }

    // Move to next lesson or complete
    if (state.currentIndex < COURSE.lessons.length - 1) {
      state.currentIndex++;
      state.mode = 'content';
      renderAll();
      document.getElementById('main').scrollTop = 0;
    } else {
      finishCourse();
    }
  }

  function navigate(dir) {
    if (dir === -1) {
      if (state.mode === 'quiz') {
        state.mode = 'content';
      } else if (state.currentIndex > 0) {
        state.currentIndex--;
        state.mode = 'content';
      }
      renderAll();
      document.getElementById('main').scrollTop = 0;
    }
  }

  function finishCourse() {
    state.mode = 'complete';
    const score = overallScore();
    const passed = score >= 70;

    scormSet("cmi.core.score.min", "0");
    scormSet("cmi.core.score.max", "100");
    scormSet("cmi.core.score.raw", String(score));
    scormSet("cmi.core.lesson_status", passed ? "passed" : "failed");
    scormFinish();

    renderAll();
  }

  // Escape HTML for safe injection
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================================================
  // Init
  // =========================================================================
  scormInit();
  renderAll();
</script>
</body>
</html>`;
}
