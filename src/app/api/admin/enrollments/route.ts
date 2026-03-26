import { NextRequest, NextResponse } from "next/server";

async function getPrismaAndTenant() {
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
  return { prisma, tenantId };
}

// GET /api/admin/enrollments?courseId=xxx
export async function GET(req: NextRequest) {
  try {
    const { prisma, tenantId } = await getPrismaAndTenant();
    if (!tenantId) return NextResponse.json({ error: "No tenant found." }, { status: 400 });

    const courseId = req.nextUrl.searchParams.get("courseId");
    const enrollments = await prisma.enrollment.findMany({
      where: {
        tenantId,
        ...(courseId ? { courseId } : {}),
      },
      include: {
        user: true,
        course: true,
        progress: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(enrollments);
  } catch (err) {
    console.error("[enrollments/GET]", err);
    return NextResponse.json({ error: "Failed to fetch enrollments." }, { status: 500 });
  }
}

// POST /api/admin/enrollments — enroll a learner in a course
export async function POST(req: NextRequest) {
  try {
    const { prisma, tenantId } = await getPrismaAndTenant();
    if (!tenantId) return NextResponse.json({ error: "No tenant found." }, { status: 400 });

    const { userId, courseId, dueDate } = await req.json();
    if (!userId || !courseId) {
      return NextResponse.json({ error: "userId and courseId are required." }, { status: 400 });
    }

    // Ensure the course exists in the DB; if not, create it from catalog
    let course = await prisma.course.findFirst({ where: { id: courseId, tenantId } });
    if (!course) {
      // Try to find from catalog.json and create
      const { readFile } = await import("fs/promises");
      const { join } = await import("path");
      try {
        const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
        const catalog = JSON.parse(raw);
        const entry = catalog.find((c: { id: string; title: string }) => c.id === courseId);
        if (entry) {
          course = await prisma.course.upsert({
            where: { id: courseId },
            update: {},
            create: {
              id: courseId,
              title: entry.title,
              description: entry.description ?? null,
              status: "published",
              tenantId,
            },
          });
        }
      } catch { /* catalog not found */ }
    }

    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId,
        tenantId,
        status: "enrolled",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { user: true, course: true },
    });

    // Send enrollment email (fire and forget)
    try {
      const { sendEnrollmentEmail } = await import("@/lib/email");
      const courseTitle = course.title;
      const userEmail = enrollment.user?.email;
      const userName = enrollment.user?.name ?? userEmail ?? "";
      if (userEmail) {
        sendEnrollmentEmail(userEmail, userName, courseTitle).catch(() => {});
      }
    } catch { /* email optional */ }

    try {
      const { auth } = await import("@/lib/auth/config");
      const session = await auth();
      const actor = session?.user as { id?: string; email?: string } | undefined;
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ action: "enrollment.create", actorId: actor?.id, actorEmail: actor?.email, targetId: enrollment.id, targetType: "Enrollment", metadata: { userId, courseId, courseTitle: course.title }, tenantId: tenantId ?? undefined });
    } catch { /* audit optional */ }

    return NextResponse.json(enrollment, { status: 201 });
  } catch (err: unknown) {
    console.error("[enrollments/POST]", err);
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Learner is already enrolled in this course." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to enroll learner." }, { status: 500 });
  }
}
