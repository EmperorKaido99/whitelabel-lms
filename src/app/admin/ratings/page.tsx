import Link from "next/link";
import { readFile } from "fs/promises";
import path from "path";

interface CatalogEntry { id: string; title: string; }

interface RatingEntry {
  userId: string;
  name: string | null;
  email: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface CourseRatingSummary {
  courseId: string;
  avg: number;
  count: number;
  ratings: RatingEntry[];
}

function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  return (
    <span style={{ fontSize: 13, letterSpacing: "-0.5px" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ color: n <= full ? "#fbbf24" : n === full + 1 && value - full >= 0.5 ? "#fbbf24" : "#2a3347", opacity: n === full + 1 && value - full >= 0.25 && value - full < 0.75 ? 0.55 : 1 }}>
          ★
        </span>
      ))}
    </span>
  );
}

async function getData(): Promise<{ summaries: (CourseRatingSummary & { title: string })[]; totalRatings: number }> {
  let catalog: CatalogEntry[] = [];
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "catalog.json"), "utf-8");
    catalog = JSON.parse(raw);
  } catch { /* no catalog yet */ }

  const titleMap = new Map(catalog.map(c => [c.id, c.title]));

  const { prisma } = await import("@/adapters/db");

  const ratings = await prisma.courseRating.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Group by courseId
  const byCourse = new Map<string, (typeof ratings[number])[]>();
  for (const r of ratings) {
    if (!byCourse.has(r.courseId)) byCourse.set(r.courseId, []);
    byCourse.get(r.courseId)!.push(r);
  }

  const summaries = Array.from(byCourse.entries()).map(([courseId, rs]) => {
    const avg = rs.reduce((s, r) => s + r.rating, 0) / rs.length;
    return {
      courseId,
      title: titleMap.get(courseId) ?? courseId.slice(0, 8) + "…",
      avg: Math.round(avg * 10) / 10,
      count: rs.length,
      ratings: rs.map(r => ({
        userId: r.userId,
        name: r.user.name,
        email: r.user.email,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  // Sort by most reviews desc
  summaries.sort((a, b) => b.count - a.count);

  return { summaries, totalRatings: ratings.length };
}

export default async function AdminRatingsPage() {
  const { summaries, totalRatings } = await getData();

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e2e8f0" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <nav style={{ borderBottom: "1px solid #13161f", padding: "0 40px", height: 54, display: "flex", alignItems: "center", gap: 24, background: "#0c0e14" }}>
        <Link href="/" style={{ color: "#f0f4ff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>◆ LMS</Link>
        <Link href="/admin" style={{ color: "#4a5568", fontSize: 13, textDecoration: "none" }}>Admin</Link>
        <Link href="/admin/analytics" style={{ color: "#4a5568", fontSize: 13, textDecoration: "none" }}>Analytics</Link>
        <span style={{ color: "#1e2433", fontSize: 12 }}>›</span>
        <span style={{ color: "#5a7aff", fontSize: 13, fontWeight: 500 }}>Course Ratings</span>
      </nav>

      <main style={{ padding: "40px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a7aff", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>
            Feedback
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f0f4ff", letterSpacing: "-0.5px" }}>Course Ratings</h1>
          <p style={{ fontSize: 13, color: "#4a5568", marginTop: 6 }}>
            {totalRatings === 0 ? "No ratings submitted yet." : `${totalRatings} rating${totalRatings === 1 ? "" : "s"} across ${summaries.length} course${summaries.length === 1 ? "" : "s"}.`}
          </p>
        </div>

        {summaries.length === 0 ? (
          <div style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, padding: "48px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>
            No ratings yet. Learners can rate courses after completing them.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {summaries.map(summary => (
              <div key={summary.courseId} style={{ background: "#0c0e14", border: "1px solid #1e2433", borderRadius: 10, overflow: "hidden" }}>
                {/* Course header */}
                <div style={{ padding: "16px 22px", borderBottom: "1px solid #13161f", display: "flex", alignItems: "center", gap: 16, background: "#080a0f" }}>
                  <div style={{ flex: 1 }}>
                    <Link href={`/catalog/${summary.courseId}`} style={{ fontSize: 15, fontWeight: 600, color: "#c5d0e8", textDecoration: "none" }}>
                      {summary.title}
                    </Link>
                    <div style={{ fontSize: 11, color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                      {summary.courseId.slice(0, 8)}…
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Stars value={summary.avg} />
                    <span style={{ fontSize: 18, fontWeight: 600, color: "#fbbf24", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {summary.avg.toFixed(1)}
                    </span>
                    <span style={{ fontSize: 12, color: "#4a5568" }}>
                      {summary.count} review{summary.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  {/* Mini bar chart */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 100 }}>
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = summary.ratings.filter(r => r.rating === star).length;
                      const pct = summary.count > 0 ? (count / summary.count) * 100 : 0;
                      return (
                        <div key={star} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 9, color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace", width: 7 }}>{star}</span>
                          <div style={{ flex: 1, height: 4, background: "#1e2433", borderRadius: 2 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: "#fbbf24", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 9, color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace", width: 14, textAlign: "right" }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Individual reviews */}
                <div>
                  {summary.ratings.map((r, i) => (
                    <div key={r.userId} style={{ padding: "14px 22px", borderBottom: i < summary.ratings.length - 1 ? "1px solid #13161f" : "none", display: "flex", gap: 14, alignItems: "flex-start" }}>
                      {/* Avatar initial */}
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a2035", border: "1px solid #2a3347", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#7a90bc", flexShrink: 0, fontWeight: 600 }}>
                        {(r.name ?? r.email).charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#c5d0e8" }}>{r.name ?? r.email}</span>
                          <span style={{ fontSize: 11, color: "#3a4a68" }}>{r.email}</span>
                          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                            <Stars value={r.rating} />
                            <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "'IBM Plex Mono', monospace" }}>
                              {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        </div>
                        {r.comment ? (
                          <p style={{ fontSize: 13, color: "#7a90bc", lineHeight: 1.5, margin: 0 }}>{r.comment}</p>
                        ) : (
                          <p style={{ fontSize: 12, color: "#2a3347", fontStyle: "italic", margin: 0 }}>No comment left.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
