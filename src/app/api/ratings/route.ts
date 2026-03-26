import { NextRequest, NextResponse } from "next/server";

async function getSession() {
  try {
    const { auth } = await import("@/lib/auth/config");
    const session = await auth();
    return {
      userId: session?.user?.id ?? null,
      tenantId: (session?.user as { tenantId?: string })?.tenantId ?? null,
    };
  } catch {
    return { userId: null, tenantId: null };
  }
}

// GET /api/ratings?courseId=xxx — aggregate rating + user's own rating
export async function GET(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

    const { prisma } = await import("@/adapters/db");
    const { userId } = await getSession();

    const ratings = await prisma.courseRating.findMany({ where: { courseId } });
    const avg = ratings.length > 0
      ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
      : null;

    const mine = userId ? ratings.find(r => r.userId === userId) ?? null : null;

    return NextResponse.json({
      avg: avg != null ? Math.round(avg * 10) / 10 : null,
      count: ratings.length,
      mine: mine ? { rating: mine.rating, comment: mine.comment } : null,
    });
  } catch (err) {
    console.error("[ratings/GET]", err);
    return NextResponse.json({ error: "Failed to fetch ratings." }, { status: 500 });
  }
}

// POST /api/ratings — submit or update a rating (only for completed courses)
export async function POST(req: NextRequest) {
  try {
    const { userId, tenantId } = await getSession();
    if (!userId || !tenantId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { courseId, rating, comment } = await req.json();
    if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });
    }

    const { prisma } = await import("@/adapters/db");

    // Verify the learner has completed the course
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId, tenantId, status: "completed" },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "You must complete this course before rating it." }, { status: 403 });
    }

    const saved = await prisma.courseRating.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { rating: Number(rating), comment: comment?.trim() ?? null },
      create: { userId, courseId, tenantId, rating: Number(rating), comment: comment?.trim() ?? null },
    });

    return NextResponse.json(saved);
  } catch (err) {
    console.error("[ratings/POST]", err);
    return NextResponse.json({ error: "Failed to submit rating." }, { status: 500 });
  }
}
