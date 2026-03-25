import Link from "next/link";
import CourseCard, { type CatalogCourse } from "./CourseCard";

async function getCatalog(): Promise<CatalogCourse[]> {
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default async function CatalogPage() {
  const courses = await getCatalog();

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #13161f",
        padding: "0 40px",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0c0e14",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none", letterSpacing: "-0.3px" }}>
            ◆ LMS
          </Link>
          <Link href="/catalog" style={{ color: "#5a7aff", fontSize: 13, textDecoration: "none", fontWeight: 500 }}>
            Course Catalog
          </Link>
        </div>
        <Link href="/admin/scorm/upload" style={{
          background: "rgba(90,122,255,0.1)",
          color: "#8099ff",
          border: "1px solid rgba(90,122,255,0.2)",
          padding: "6px 14px",
          borderRadius: 5,
          fontSize: 13,
          textDecoration: "none",
          fontWeight: 500,
        }}>
          + Upload Course
        </Link>
      </nav>

      <main style={{ padding: "48px 40px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: 11,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#5a7aff",
            fontFamily: "'IBM Plex Mono', monospace",
            marginBottom: 12,
          }}>
            Course Catalog
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.8px", marginBottom: 8 }}>
            Available Courses
          </h1>
          <p style={{ color: "#4a5568", fontSize: 15, lineHeight: 1.6 }}>
            {courses.length === 0
              ? "No courses published yet."
              : `${courses.length} course${courses.length === 1 ? "" : "s"} available for learning`}
          </p>
        </div>

        {/* Empty state */}
        {courses.length === 0 && (
          <div style={{
            border: "2px dashed #1e2433",
            borderRadius: 12,
            padding: "80px 40px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>📚</div>
            <h2 style={{ fontSize: 20, fontWeight: 500, color: "#c5d0e8", margin: 0 }}>
              No courses yet
            </h2>
            <p style={{ color: "#4a5568", fontSize: 14, margin: 0 }}>
              Upload a SCORM package and publish it to see it here.
            </p>
            <Link href="/admin/scorm/upload" style={{
              marginTop: 8,
              background: "#5a7aff",
              color: "#fff",
              padding: "10px 24px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 500,
              fontSize: 14,
            }}>
              Upload Your First Course
            </Link>
          </div>
        )}

        {/* Course grid */}
        {courses.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}>
            {courses.map((course, i) => (
              <CourseCard key={course.id} course={course} index={i} />
            ))}
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
      `}</style>
    </div>
  );
}
