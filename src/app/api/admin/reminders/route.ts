import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/reminders
 * Sends due-date reminder emails to learners whose enrollments:
 *  - are not completed
 *  - have a dueDate set
 *  - are either overdue OR due within `withinDays` days (default: 3)
 *
 * Returns a summary of emails sent.
 */
export async function POST(req: NextRequest) {
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
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const withinDays: number = body.withinDays ?? 3;
    const windowEnd = new Date(Date.now() + withinDays * 86400000);

    // Load catalog for course titles
    let catalogMap: Record<string, string> = {};
    try {
      const { readFile } = await import("fs/promises");
      const { join } = await import("path");
      const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
      const entries: { id: string; title: string }[] = JSON.parse(raw);
      catalogMap = Object.fromEntries(entries.map(e => [e.id, e.title]));
    } catch { /* catalog optional */ }

    // Find eligible enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: {
        tenantId,
        status: { not: "completed" },
        dueDate: { not: null, lte: windowEnd },
      },
      include: { user: true, course: true },
    });

    const { sendDueDateReminderEmail } = await import("@/lib/email");
    let sent = 0;
    const errors: string[] = [];

    for (const e of enrollments) {
      if (!e.dueDate || !e.user?.email) continue;
      const overdue = e.dueDate < new Date();
      const courseTitle = catalogMap[e.courseId] ?? e.course?.title ?? e.courseId;
      try {
        await sendDueDateReminderEmail(
          e.user.email,
          e.user.name ?? e.user.email,
          courseTitle,
          e.dueDate,
          overdue,
        );
        sent++;
      } catch (err) {
        errors.push(`${e.user.email}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    return NextResponse.json({ sent, total: enrollments.length, errors });
  } catch (err) {
    console.error("[reminders/POST]", err);
    return NextResponse.json({ error: "Failed to send reminders." }, { status: 500 });
  }
}
