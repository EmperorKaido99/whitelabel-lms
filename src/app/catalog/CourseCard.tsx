"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface CatalogCourse {
  id: string;
  packageId: string;
  title: string;
  description?: string;
  categories?: string[];
  imageUrl?: string;
  entryPoint: string;
  version: string;
  fileCount: number;
  publishedAt: string;
}

function StarDisplay({ avg, count }: { avg: number; count: number }) {
  const full = Math.floor(avg);
  const half = avg - full >= 0.25 && avg - full < 0.75;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 12, letterSpacing: "-1px" }}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} style={{ color: n <= full ? "#fbbf24" : (n === full + 1 && half) ? "#fbbf24" : "#2a3347", opacity: (n === full + 1 && half) ? 0.5 : 1 }}>★</span>
        ))}
      </span>
      <span style={{ fontSize: 11, color: "#7a90bc", fontFamily: "'IBM Plex Mono', monospace" }}>
        {avg.toFixed(1)} <span style={{ color: "#3a4a68" }}>({count})</span>
      </span>
    </div>
  );
}

export default function CourseCard({ course, index }: { course: CatalogCourse; index: number }) {
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);

  useEffect(() => {
    fetch(`/api/ratings?courseId=${encodeURIComponent(course.id)}`)
      .then(r => r.json())
      .then((d: { avg: number | null; count: number }) => {
        if (d.avg != null && d.count > 0) setRating({ avg: d.avg, count: d.count });
      })
      .catch(() => {/* ignore */});
  }, [course.id]);
  const colors = [
    { accent: "#5a7aff", bg: "rgba(90,122,255,0.08)", border: "rgba(90,122,255,0.15)" },
    { accent: "#22d3ee", bg: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.15)" },
    { accent: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.15)" },
    { accent: "#4ade80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.15)" },
  ];
  const color = colors[index % colors.length];

  const publishedDate = new Date(course.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Link href={`/catalog/${course.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{ background: "#111520", border: "1px solid #1e2433", borderRadius: 10, overflow: "hidden", transition: "all 0.2s ease", cursor: "pointer" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = color.accent;
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.3)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#1e2433";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        {/* Thumbnail or accent bar */}
        {course.imageUrl ? (
          <div style={{ height: 140, background: `url(${course.imageUrl}) center/cover no-repeat`, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(17,21,32,0.9))" }} />
          </div>
        ) : (
          <div style={{ height: 4, background: `linear-gradient(90deg, ${color.accent}, transparent)` }} />
        )}

        <div style={{ padding: "20px 22px 22px" }}>
          {/* Version + categories */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 8px", borderRadius: 3, background: color.bg, border: `1px solid ${color.border}`, color: color.accent, letterSpacing: "0.5px" }}>
              SCORM {course.version}
            </span>
            {(course.categories ?? []).slice(0, 2).map(cat => (
              <span key={cat} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: "rgba(255,255,255,0.04)", border: "1px solid #2a3347", color: "#7a90bc" }}>
                {cat}
              </span>
            ))}
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 8, letterSpacing: "-0.2px", lineHeight: 1.4 }}>
            {course.title}
          </h2>

          {course.description && (
            <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.5, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {course.description}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 18 }}>
            <span style={{ fontSize: 12, color: "#3a4a68", fontFamily: "'IBM Plex Mono', monospace" }}>
              {course.fileCount} files · {course.entryPoint.split("/").pop()}
            </span>
            <span style={{ fontSize: 12, color: "#3a4a68" }}>Published {publishedDate}</span>
          </div>

          {rating && (
            <div style={{ marginBottom: 14 }}>
              <StarDisplay avg={rating.avg} count={rating.count} />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 6, color: color.accent, fontSize: 13, fontWeight: 500 }}>
            <span>Launch Course</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
