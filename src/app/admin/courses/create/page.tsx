"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Lesson {
  title: string;
  description: string;
  estimatedDuration: string;
  content: string;
  keyTakeaways: string[];
  quiz: QuizQuestion[];
}

interface CourseData {
  title: string;
  description: string;
  targetAudience: string;
  estimatedDuration: string;
  objectives: string[];
  lessons: Lesson[];
}

type Step = 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function CreateCoursePage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Step 1 — Source material
  const [description, setDescription] = useState("");
  const [references, setReferences] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Step 2-4 — Course data
  const [course, setCourse] = useState<CourseData | null>(null);

  // Step 4 — active lesson being previewed
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);

  // Output
  const [outputLoading, setOutputLoading] = useState<"download" | "publish" | null>(null);
  const [outputError, setOutputError] = useState("");
  const [publishedId, setPublishedId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------
  const ACCEPTED = [".pdf", ".docx", ".xlsx", ".pptx"];
  const isValidFile = (f: File) =>
    ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext));

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(isValidFile);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  // ---------------------------------------------------------------------------
  // Generate course structure (Step 1 → 2)
  // ---------------------------------------------------------------------------
  const handleGenerate = async () => {
    if (!description.trim() && files.length === 0 && !references.trim()) {
      setGenError("Please describe your course or upload source materials.");
      return;
    }
    setGenError("");
    setGenerating(true);

    try {
      const fd = new FormData();
      fd.append("description", description);
      fd.append("references", references);
      files.forEach((f) => fd.append("files", f));

      const res = await fetch("/api/admin/courses/generate", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Generation failed. Please try again.");
        return;
      }
      setCourse(data.course as CourseData);
      setStep(2);
    } catch {
      setGenError("Could not reach the server. Is the dev server running?");
    } finally {
      setGenerating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // SCORM output (Step 4)
  // ---------------------------------------------------------------------------
  const handleScorm = async (action: "download" | "publish") => {
    if (!course) return;
    setOutputError("");
    setOutputLoading(action);

    try {
      const res = await fetch("/api/admin/courses/generate-scorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course, action }),
      });

      if (action === "download") {
        if (!res.ok) {
          const d = await res.json();
          setOutputError(d.error ?? "Download failed.");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          (course.title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_") || "course") +
          "_scorm.zip";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        if (!res.ok) {
          setOutputError(data.error ?? "Publish failed.");
          return;
        }
        setPublishedId(data.packageId);
      }
    } catch {
      setOutputError("Request failed. Check the dev server.");
    } finally {
      setOutputLoading(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Course editing helpers
  // ---------------------------------------------------------------------------
  const updateCourse = (patch: Partial<CourseData>) =>
    setCourse((c) => (c ? { ...c, ...patch } : c));

  const updateLesson = (idx: number, patch: Partial<Lesson>) =>
    setCourse((c) =>
      c
        ? {
            ...c,
            lessons: c.lessons.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
          }
        : c
    );

  const addLesson = () => {
    if (!course) return;
    const newLesson: Lesson = {
      title: "New Lesson",
      description: "",
      estimatedDuration: "15 minutes",
      content: "<p>Add your lesson content here.</p>",
      keyTakeaways: ["Key takeaway 1"],
      quiz: [],
    };
    setCourse({ ...course, lessons: [...course.lessons, newLesson] });
  };

  const removeLesson = (idx: number) => {
    if (!course || course.lessons.length <= 1) return;
    const next = { ...course, lessons: course.lessons.filter((_, i) => i !== idx) };
    setCourse(next);
    setActiveLessonIdx(Math.min(activeLessonIdx, next.lessons.length - 1));
  };

  const updateQuiz = (lessonIdx: number, qIdx: number, patch: Partial<QuizQuestion>) =>
    updateLesson(lessonIdx, {
      quiz: course!.lessons[lessonIdx].quiz.map((q, i) =>
        i === qIdx ? { ...q, ...patch } : q
      ),
    });

  const addQuestion = (lessonIdx: number) => {
    const lesson = course!.lessons[lessonIdx];
    updateLesson(lessonIdx, {
      quiz: [
        ...lesson.quiz,
        { question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" },
      ],
    });
  };

  const removeQuestion = (lessonIdx: number, qIdx: number) =>
    updateLesson(lessonIdx, {
      quiz: course!.lessons[lessonIdx].quiz.filter((_, i) => i !== qIdx),
    });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, textarea:focus, select:focus { outline: none !important; border-color: #5a7aff !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0c0e14; }
        ::-webkit-scrollbar-thumb { background: #2a3347; border-radius: 3px; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none", letterSpacing: "-0.3px" }}>◆ LMS</Link>
          <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Admin</span>
          <Link href="/admin" style={navLink}>Dashboard</Link>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/scorm/upload" style={ghostBtn}>Upload SCORM</Link>
        </div>
      </nav>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "36px 40px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>
            AI Course Creator
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px", marginBottom: 4 }}>
            Create a Course with AI
          </h1>
          <p style={{ color: "#4a5568", fontSize: 14 }}>
            Describe your course and upload source materials — AI will generate a complete SCORM 1.2 package.
          </p>
        </div>

        {/* Breadcrumb steps */}
        <Breadcrumbs step={step} />

        {/* ---- STEP 1: Source Material ---- */}
        {step === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, marginTop: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Description */}
              <div>
                <label style={labelStyle}>Describe your course <span style={{ color: "#f87171" }}>*</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. A course on workplace safety for new employees covering fire safety, emergency procedures, and personal protective equipment…"
                  rows={5}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                />
              </div>

              {/* File upload */}
              <div>
                <label style={labelStyle}>Upload source materials <span style={{ color: "#4a5568", fontWeight: 400 }}>(optional)</span></label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? "#5a7aff" : "#2a3347"}`,
                    borderRadius: 8,
                    background: dragging ? "#0f1830" : "#0c0e14",
                    padding: "28px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.pptx"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                  />
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 14, color: "#7a90bc", marginBottom: 4 }}>
                    {dragging ? "Release to add files" : "Drop files here or click to browse"}
                  </div>
                  <div style={{ fontSize: 12, color: "#3a4a68" }}>PDF, DOCX, XLSX, PPTX supported</div>
                </div>
                {files.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {files.map((f) => (
                      <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 6, padding: "8px 12px" }}>
                        <span style={{ fontSize: 13, color: "#c5d0e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          📎 {f.name}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); removeFile(f.name); }} style={{ background: "none", border: "none", color: "#4a5568", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* References */}
              <div>
                <label style={labelStyle}>Paste text or URLs to reference <span style={{ color: "#4a5568", fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  value={references}
                  onChange={(e) => setReferences(e.target.value)}
                  placeholder="Paste any additional text, URLs, or key points you want included in the course…"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                />
              </div>

              {genError && (
                <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#f87171", fontSize: 13 }}>
                  {genError}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{ ...primaryBtnStyle, opacity: generating ? 0.7 : 1, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, width: "fit-content" }}
              >
                {generating ? (
                  <>
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Generating course…
                  </>
                ) : (
                  "Generate course details →"
                )}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>

            {/* Sidebar tips */}
            <aside style={{ background: "#0c0e14", border: "1px solid #1a2035", borderRadius: 8, padding: 22, height: "fit-content" }}>
              <div style={sectionLabelStyle}>How it works</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  ["1", "Describe your course topic and goals"],
                  ["2", "Upload PDFs, DOCX, XLSX or PPTX for context"],
                  ["3", "AI generates full course structure"],
                  ["4", "Review & edit all content"],
                  ["5", "Download SCORM or publish directly"],
                ].map(([num, text]) => (
                  <div key={num} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(90,122,255,0.12)", border: "1px solid rgba(90,122,255,0.2)", color: "#5a7aff", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{num}</span>
                    <span style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid #1e2433", margin: "18px 0" }} />
              <div style={sectionLabelStyle}>Supported formats</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["PDF", "DOCX", "XLSX", "PPTX"].map((f) => (
                  <span key={f} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 8px", background: "#111520", border: "1px solid #2a3347", borderRadius: 3, color: "#7a90bc" }}>{f}</span>
                ))}
              </div>
            </aside>
          </div>
        )}

        {/* ---- STEP 2: Course Details ---- */}
        {step === 2 && course && (
          <div style={{ marginTop: 32, maxWidth: 680 }}>
            <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>

              <div>
                <label style={labelStyle}>Course Title</label>
                <input value={course.title} onChange={(e) => updateCourse({ title: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={course.description} onChange={(e) => updateCourse({ description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Target Audience</label>
                  <input value={course.targetAudience} onChange={(e) => updateCourse({ targetAudience: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Estimated Duration</label>
                  <input value={course.estimatedDuration} onChange={(e) => updateCourse({ estimatedDuration: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Learning Objectives</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {course.objectives.map((obj, i) => (
                    <div key={i} style={{ display: "flex", gap: 8 }}>
                      <input
                        value={obj}
                        onChange={(e) => updateCourse({ objectives: course.objectives.map((o, j) => j === i ? e.target.value : o) })}
                        style={{ ...inputStyle, flex: 1 }}
                        placeholder={`Objective ${i + 1}`}
                      />
                      <button
                        onClick={() => updateCourse({ objectives: course.objectives.filter((_, j) => j !== i) })}
                        style={{ ...ghostBtnStyle, padding: "8px 12px", color: "#f87171", borderColor: "rgba(239,68,68,0.2)" }}
                        disabled={course.objectives.length <= 1}
                      >×</button>
                    </div>
                  ))}
                  <button onClick={() => updateCourse({ objectives: [...course.objectives, ""] })} style={{ ...ghostBtnStyle, width: "fit-content", fontSize: 12 }}>
                    + Add objective
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={ghostBtnStyle}>← Back</button>
              <button onClick={() => setStep(3)} style={{ ...primaryBtnStyle }} disabled={!course.title.trim()}>
                Generate course outline →
              </button>
            </div>
          </div>
        )}

        {/* ---- STEP 3: Course Outline ---- */}
        {step === 3 && course && (
          <div style={{ marginTop: 32, maxWidth: 680 }}>
            <p style={{ fontSize: 13, color: "#4a5568", marginBottom: 20 }}>
              Review and reorder your lessons before generating full content.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {course.lessons.map((lesson, i) => (
                <div key={i} style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 8, padding: 18 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(90,122,255,0.12)", border: "1px solid rgba(90,122,255,0.2)", color: "#5a7aff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        value={lesson.title}
                        onChange={(e) => updateLesson(i, { title: e.target.value })}
                        style={{ ...inputStyle, marginBottom: 8, fontWeight: 500 }}
                        placeholder="Lesson title"
                      />
                      <input
                        value={lesson.description}
                        onChange={(e) => updateLesson(i, { description: e.target.value })}
                        style={{ ...inputStyle, fontSize: 12, color: "#7a90bc" }}
                        placeholder="Brief lesson description"
                      />
                      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                        <input
                          value={lesson.estimatedDuration}
                          onChange={(e) => updateLesson(i, { estimatedDuration: e.target.value })}
                          style={{ ...inputStyle, width: 150, fontSize: 12 }}
                          placeholder="e.g. 15 minutes"
                        />
                        <span style={{ fontSize: 12, color: "#3a4a68", display: "flex", alignItems: "center" }}>
                          {lesson.quiz?.length ?? 0} quiz question{(lesson.quiz?.length ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeLesson(i)}
                      disabled={course.lessons.length <= 1}
                      style={{ background: "none", border: "none", color: "#4a5568", cursor: "pointer", fontSize: 18, padding: "2px 6px", flexShrink: 0, lineHeight: 1 }}
                      title="Remove lesson"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addLesson} style={{ ...ghostBtnStyle, marginTop: 10, width: "100%", justifyContent: "center", display: "flex" }}>
              + Add Lesson
            </button>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={ghostBtnStyle}>← Back</button>
              <button onClick={() => { setActiveLessonIdx(0); setStep(4); }} style={primaryBtnStyle}>
                Generate lesson drafts →
              </button>
            </div>
          </div>
        )}

        {/* ---- STEP 4: Lesson Drafts ---- */}
        {step === 4 && course && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>

              {/* Lesson sidebar */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={sectionLabelStyle}>Lessons</div>
                {course.lessons.map((l, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveLessonIdx(i)}
                    style={{
                      background: activeLessonIdx === i ? "rgba(90,122,255,0.1)" : "transparent",
                      border: `1px solid ${activeLessonIdx === i ? "rgba(90,122,255,0.25)" : "transparent"}`,
                      borderRadius: 6,
                      padding: "9px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "'IBM Plex Sans', sans-serif",
                      color: activeLessonIdx === i ? "#8099ff" : "#4a5568",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 11, width: 20, height: 20, borderRadius: "50%", background: activeLessonIdx === i ? "rgba(90,122,255,0.2)" : "#1e2433", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: activeLessonIdx === i ? "#5a7aff" : "#4a5568" }}>{i + 1}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                  </button>
                ))}
              </div>

              {/* Lesson editor */}
              <LessonEditor
                lesson={course.lessons[activeLessonIdx]}
                lessonIndex={activeLessonIdx}
                onUpdate={(patch) => updateLesson(activeLessonIdx, patch)}
                onUpdateQuiz={(qi, patch) => updateQuiz(activeLessonIdx, qi, patch)}
                onAddQuestion={() => addQuestion(activeLessonIdx)}
                onRemoveQuestion={(qi) => removeQuestion(activeLessonIdx, qi)}
              />
            </div>

            {/* Output actions */}
            <div style={{ marginTop: 32, borderTop: "1px solid #1e2433", paddingTop: 28 }}>
              {outputError && (
                <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#f87171", fontSize: 13, marginBottom: 16 }}>
                  {outputError}
                </div>
              )}
              {publishedId ? (
                <div style={{ padding: "16px 20px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#4ade80", marginBottom: 6 }}>Course published successfully!</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <Link href={`/catalog/${publishedId}`} style={{ ...primaryBtnStyle, textDecoration: "none", display: "inline-flex" }}>View in Catalog</Link>
                    <button onClick={() => router.push("/admin")} style={ghostBtnStyle}>Back to Dashboard</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button onClick={() => setStep(3)} style={ghostBtnStyle}>← Back</button>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => handleScorm("download")}
                    disabled={!!outputLoading}
                    style={{ ...ghostBtnStyle, display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {outputLoading === "download" ? <Spinner /> : null}
                    Download SCORM Package
                  </button>
                  <button
                    onClick={() => handleScorm("publish")}
                    disabled={!!outputLoading}
                    style={{ ...primaryBtnStyle, display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {outputLoading === "publish" ? <Spinner /> : null}
                    Publish to Catalog
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------
function Breadcrumbs({ step }: { step: Step }) {
  const steps = [
    { num: 1, label: "Source material" },
    { num: 2, label: "Course details" },
    { num: 3, label: "Course outline" },
    { num: 4, label: "Lesson drafts" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, i) => (
        <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: step === s.num ? "#5a7aff" : step > s.num ? "rgba(74,222,128,0.12)" : "#111520",
              border: `1.5px solid ${step === s.num ? "#5a7aff" : step > s.num ? "rgba(74,222,128,0.3)" : "#2a3347"}`,
              color: step === s.num ? "#fff" : step > s.num ? "#4ade80" : "#3a4a68",
              fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {step > s.num ? "✓" : s.num}
            </div>
            <span style={{ fontSize: 13, color: step === s.num ? "#c5d0e8" : step > s.num ? "#4ade80" : "#3a4a68", fontWeight: step === s.num ? 500 : 400 }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 32, height: 1, background: step > s.num ? "rgba(74,222,128,0.2)" : "#1e2433", margin: "0 8px" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson editor panel
// ---------------------------------------------------------------------------
function LessonEditor({
  lesson,
  lessonIndex,
  onUpdate,
  onUpdateQuiz,
  onAddQuestion,
  onRemoveQuestion,
}: {
  lesson: Lesson;
  lessonIndex: number;
  onUpdate: (patch: Partial<Lesson>) => void;
  onUpdateQuiz: (qi: number, patch: Partial<QuizQuestion>) => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (qi: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<"content" | "takeaways" | "quiz">("content");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    border: "none",
    borderBottom: `2px solid ${active ? "#5a7aff" : "transparent"}`,
    background: "transparent",
    color: active ? "#8099ff" : "#4a5568",
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    cursor: "pointer",
    fontFamily: "'IBM Plex Sans', sans-serif",
    transition: "all 0.15s",
  });

  return (
    <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, overflow: "hidden" }}>
      {/* Lesson title + duration */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e2433" }}>
        <input
          value={lesson.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          style={{ ...inputStyle, fontSize: 16, fontWeight: 500, marginBottom: 10 }}
          placeholder="Lesson title"
        />
        <div style={{ display: "flex", gap: 12 }}>
          <input
            value={lesson.estimatedDuration}
            onChange={(e) => onUpdate({ estimatedDuration: e.target.value })}
            style={{ ...inputStyle, width: 160, fontSize: 12 }}
            placeholder="Duration"
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #1e2433", display: "flex", padding: "0 24px" }}>
        <button style={tabStyle(activeTab === "content")} onClick={() => setActiveTab("content")}>Content</button>
        <button style={tabStyle(activeTab === "takeaways")} onClick={() => setActiveTab("takeaways")}>Takeaways ({lesson.keyTakeaways.length})</button>
        <button style={tabStyle(activeTab === "quiz")} onClick={() => setActiveTab("quiz")}>Quiz ({lesson.quiz.length})</button>
      </div>

      <div style={{ padding: 24 }}>

        {/* Content tab */}
        {activeTab === "content" && (
          <div>
            <label style={labelStyle}>Lesson HTML Content</label>
            <textarea
              value={lesson.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={16}
              spellCheck={false}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.6 }}
              placeholder="<h2>Lesson title</h2><p>Lesson content...</p>"
            />
            <p style={{ fontSize: 11, color: "#3a4a68", marginTop: 6 }}>
              Supports HTML: &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;blockquote&gt;
            </p>
          </div>
        )}

        {/* Takeaways tab */}
        {activeTab === "takeaways" && (
          <div>
            <label style={labelStyle}>Key Takeaways</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lesson.keyTakeaways.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={t}
                    onChange={(e) => onUpdate({ keyTakeaways: lesson.keyTakeaways.map((k, j) => j === i ? e.target.value : k) })}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder={`Takeaway ${i + 1}`}
                  />
                  <button
                    onClick={() => onUpdate({ keyTakeaways: lesson.keyTakeaways.filter((_, j) => j !== i) })}
                    style={{ background: "none", border: "none", color: "#4a5568", cursor: "pointer", fontSize: 18, padding: "0 8px" }}
                    disabled={lesson.keyTakeaways.length <= 1}
                  >×</button>
                </div>
              ))}
              <button onClick={() => onUpdate({ keyTakeaways: [...lesson.keyTakeaways, ""] })} style={{ ...ghostBtnStyle, width: "fit-content", fontSize: 12 }}>
                + Add takeaway
              </button>
            </div>
          </div>
        )}

        {/* Quiz tab */}
        {activeTab === "quiz" && (
          <div>
            {lesson.quiz.length === 0 && (
              <p style={{ fontSize: 13, color: "#3a4a68", marginBottom: 16 }}>No quiz questions yet.</p>
            )}
            {lesson.quiz.map((q, qi) => (
              <div key={qi} style={{ background: "#080a0f", border: "1px solid #1e2433", borderRadius: 8, padding: 18, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "#5a7aff", fontWeight: 600 }}>Question {qi + 1}</span>
                  <button onClick={() => onRemoveQuestion(qi)} style={{ background: "none", border: "none", color: "#4a5568", cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
                <input
                  value={q.question}
                  onChange={(e) => onUpdateQuiz(qi, { question: e.target.value })}
                  style={{ ...inputStyle, marginBottom: 12 }}
                  placeholder="Question text"
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {q.options.map((opt, oi) => (
                    <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="radio"
                        name={`correct_l${lessonIndex}_q${qi}`}
                        checked={q.correctIndex === oi}
                        onChange={() => onUpdateQuiz(qi, { correctIndex: oi })}
                        style={{ accentColor: "#5a7aff", width: 14, height: 14, flexShrink: 0 }}
                        title="Set as correct answer"
                      />
                      <input
                        value={opt}
                        onChange={(e) => onUpdateQuiz(qi, { options: q.options.map((o, j) => j === oi ? e.target.value : o) })}
                        style={{ ...inputStyle, flex: 1, fontSize: 13 }}
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      />
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: "#3a4a68" }}>● = correct answer</p>
                </div>
                <div>
                  <label style={{ ...labelStyle, marginBottom: 4 }}>Explanation</label>
                  <input
                    value={q.explanation}
                    onChange={(e) => onUpdateQuiz(qi, { explanation: e.target.value })}
                    style={{ ...inputStyle, fontSize: 13 }}
                    placeholder="Why is this the correct answer?"
                  />
                </div>
              </div>
            ))}
            <button onClick={onAddQuestion} style={{ ...ghostBtnStyle, width: "100%", justifyContent: "center", display: "flex" }}>
              + Add Question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
function Spinner() {
  return (
    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const navLink: React.CSSProperties = { color: "#4a5568", fontSize: 13, textDecoration: "none", padding: "4px 8px", borderRadius: 4 };
const primaryBtnStyle: React.CSSProperties = { background: "#5a7aff", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", transition: "background 0.15s" };
const ghostBtnStyle: React.CSSProperties = { background: "transparent", color: "#7a90bc", border: "1px solid #2a3347", padding: "9px 18px", borderRadius: 6, fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", transition: "all 0.15s" };
const ghostBtn: React.CSSProperties = { background: "transparent", color: "#7a90bc", padding: "7px 16px", borderRadius: 5, fontSize: 13, textDecoration: "none", border: "1px solid #2a3347" };
const inputStyle: React.CSSProperties = { width: "100%", background: "#080a0f", border: "1px solid #2a3347", borderRadius: 6, padding: "9px 12px", fontSize: 13, color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 500, color: "#7a90bc", marginBottom: 6, letterSpacing: "0.3px" };
const sectionLabelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#3a4a68", marginBottom: 12 };
