import { NextResponse } from "next/server";

// GET /api/admin/ratings — all ratings grouped by course, with comments
export async function GET() {
  try {
    const { prisma } = await import("@/adapters/db");

    const ratings = await prisma.courseRating.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Group by courseId
    const byCourse = new Map<string, {
      courseId: string;
      ratings: { userId: string; name: string | null; email: string; rating: number; comment: string | null; createdAt: Date }[];
    }>();

    for (const r of ratings) {
      if (!byCourse.has(r.courseId)) {
        byCourse.set(r.courseId, { courseId: r.courseId, ratings: [] });
      }
      byCourse.get(r.courseId)!.ratings.push({
        userId: r.userId,
        name: r.user.name,
        email: r.user.email,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      });
    }

    const result = Array.from(byCourse.values()).map(({ courseId, ratings }) => {
      const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
      return {
        courseId,
        avg: Math.round(avg * 10) / 10,
        count: ratings.length,
        ratings,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/ratings GET]", err);
    return NextResponse.json({ error: "Failed to load ratings." }, { status: 500 });
  }
}
