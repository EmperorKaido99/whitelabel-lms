import { NextRequest, NextResponse } from "next/server";

// POST /api/progress — save SCORM progress for a learner
export async function POST(req: NextRequest) {
  try {
    const { prisma } = await import("@/adapters/db");

    let userId: string | null = null;
    let tenantId: string | null = null;
    try {
      const { auth } = await import("@/lib/auth/config");
      const session = await auth();
      userId = session?.user?.id ?? null;
      tenantId = (session?.user as { tenantId?: string })?.tenantId ?? null;
    } catch { /* no auth */ }

    if (!tenantId) {
      const tenant = await prisma.tenant.findFirst({ where: { slug: "demo" } });
      tenantId = tenant?.id ?? null;
    }

    const body = await req.json();
    const { courseId, cmi, score, completed, timeSpent } = body;
    if (!courseId) return NextResponse.json({ error: "courseId is required." }, { status: 400 });

    // Without a logged-in user we can't link to an enrollment — return success silently
    if (!userId) return NextResponse.json({ saved: false, reason: "unauthenticated" });

    // Find enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId, tenantId: tenantId ?? undefined },
    });
    if (!enrollment) return NextResponse.json({ saved: false, reason: "not_enrolled" });

    const completedAt = completed ? new Date() : undefined;

    await prisma.progress.upsert({
      where: { enrollmentId: enrollment.id },
      update: {
        cmi: typeof cmi === "string" ? cmi : JSON.stringify(cmi ?? {}),
        score: score ?? undefined,
        completedAt,
        timeSpent: timeSpent ?? undefined,
      },
      create: {
        enrollmentId: enrollment.id,
        tenantId: tenantId!,
        cmi: typeof cmi === "string" ? cmi : JSON.stringify(cmi ?? {}),
        score: score ?? null,
        completedAt: completedAt ?? null,
        timeSpent: timeSpent ?? null,
      },
    });

    // Update enrollment status if completed
    if (completed) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "completed" },
      });
    }

    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error("[progress/POST]", err);
    return NextResponse.json({ error: "Failed to save progress." }, { status: 500 });
  }
}

// GET /api/progress?courseId=xxx — get progress for the current user
export async function GET(req: NextRequest) {
  try {
    const { prisma } = await import("@/adapters/db");

    let userId: string | null = null;
    let tenantId: string | null = null;
    try {
      const { auth } = await import("@/lib/auth/config");
      const session = await auth();
      userId = session?.user?.id ?? null;
      tenantId = (session?.user as { tenantId?: string })?.tenantId ?? null;
    } catch { /* no auth */ }

    if (!userId) return NextResponse.json(null);

    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!courseId) return NextResponse.json({ error: "courseId required." }, { status: 400 });

    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId, tenantId: tenantId ?? undefined },
      include: { progress: true },
    });

    return NextResponse.json(enrollment?.progress ?? null);
  } catch (err) {
    console.error("[progress/GET]", err);
    return NextResponse.json({ error: "Failed to fetch progress." }, { status: 500 });
  }
}
