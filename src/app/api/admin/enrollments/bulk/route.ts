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

// POST /api/admin/enrollments/bulk
// Body: { courseId, userIds?: string[], emails?: string[] }
export async function POST(req: NextRequest) {
  try {
    const { prisma, tenantId } = await getPrismaAndTenant();
    if (!tenantId) return NextResponse.json({ error: "No tenant found." }, { status: 400 });

    const { courseId, userIds = [], emails = [] } = await req.json();
    if (!courseId) return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    if (userIds.length === 0 && emails.length === 0) {
      return NextResponse.json({ error: "Provide at least one userId or email." }, { status: 400 });
    }

    // Resolve emails to user IDs
    let resolvedIds: string[] = [...userIds];
    if (emails.length > 0) {
      const cleanEmails = emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean);
      const users = await prisma.user.findMany({
        where: { email: { in: cleanEmails }, tenantId },
        select: { id: true, email: true },
      });
      resolvedIds = [...new Set([...resolvedIds, ...users.map(u => u.id)])];
    }

    if (resolvedIds.length === 0) {
      return NextResponse.json({ error: "No matching users found." }, { status: 404 });
    }

    // Ensure course exists in DB
    let course = await prisma.course.findFirst({ where: { id: courseId, tenantId } });
    if (!course) {
      try {
        const { readFile } = await import("fs/promises");
        const { join } = await import("path");
        const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
        const catalog = JSON.parse(raw);
        const entry = catalog.find((c: { id: string; title: string }) => c.id === courseId);
        if (entry) {
          course = await prisma.course.upsert({
            where: { id: courseId },
            update: {},
            create: { id: courseId, title: entry.title, status: "published", tenantId },
          });
        }
      } catch { /* catalog not found */ }
    }
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

    // Get existing enrollments to skip duplicates
    const existing = await prisma.enrollment.findMany({
      where: { courseId, tenantId, userId: { in: resolvedIds } },
      select: { userId: true },
    });
    const alreadyEnrolled = new Set(existing.map(e => e.userId));
    const toEnroll = resolvedIds.filter(id => !alreadyEnrolled.has(id));

    if (toEnroll.length === 0) {
      return NextResponse.json({ enrolled: 0, skipped: resolvedIds.length, message: "All selected learners are already enrolled." });
    }

    // Bulk create enrollments
    await prisma.enrollment.createMany({
      data: toEnroll.map(userId => ({
        userId,
        courseId,
        tenantId,
        status: "enrolled",
      })),
    });

    // Send enrollment emails (fire and forget)
    try {
      const { sendEnrollmentEmail } = await import("@/lib/email");
      const users = await prisma.user.findMany({ where: { id: { in: toEnroll } } });
      for (const user of users) {
        sendEnrollmentEmail(user.email, user.name ?? user.email, course.title).catch(() => {});
      }
    } catch { /* email optional */ }

    return NextResponse.json({
      enrolled: toEnroll.length,
      skipped: alreadyEnrolled.size,
      message: `Enrolled ${toEnroll.length} learner${toEnroll.length !== 1 ? "s" : ""}${alreadyEnrolled.size > 0 ? `, ${alreadyEnrolled.size} already enrolled` : ""}.`,
    });
  } catch (err) {
    console.error("[enrollments/bulk]", err);
    return NextResponse.json({ error: "Bulk enrollment failed." }, { status: 500 });
  }
}
