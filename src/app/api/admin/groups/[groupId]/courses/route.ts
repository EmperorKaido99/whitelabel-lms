import { NextRequest, NextResponse } from "next/server";

async function getTenantId() {
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

// POST /api/admin/groups/[groupId]/courses — assign a course and bulk-enroll all members
export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const { courseId, dueDate } = await req.json();
    if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

    // Verify group belongs to tenant
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group || group.tenantId !== tenantId) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Save GroupCourse assignment
    await prisma.groupCourse.upsert({
      where: { groupId_courseId: { groupId, courseId } },
      update: { dueDate: dueDate ? new Date(dueDate) : null },
      create: { groupId, courseId, tenantId, dueDate: dueDate ? new Date(dueDate) : null },
    });

    // Ensure course exists in DB
    let course = await prisma.course.findFirst({ where: { id: courseId, tenantId } });
    if (!course) {
      try {
        const { readFile } = await import("fs/promises");
        const { join } = await import("path");
        const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
        const catalog: { id: string; title: string; description?: string }[] = JSON.parse(raw);
        const entry = catalog.find(c => c.id === courseId);
        if (entry) {
          course = await prisma.course.upsert({
            where: { id: courseId },
            update: {},
            create: { id: courseId, title: entry.title, description: entry.description ?? null, status: "published", tenantId },
          });
        }
      } catch { /* catalog optional */ }
    }

    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    // Bulk-enroll all group members (skip existing enrollments)
    let enrolled = 0;
    for (const member of group.members) {
      try {
        await prisma.enrollment.create({
          data: {
            userId: member.userId,
            courseId,
            tenantId,
            status: "enrolled",
            dueDate: dueDate ? new Date(dueDate) : null,
          },
        });
        enrolled++;
      } catch {
        // Unique constraint = already enrolled, skip
      }
    }

    return NextResponse.json({ ok: true, enrolled });
  } catch (err) {
    console.error("[group-courses/POST]", err);
    return NextResponse.json({ error: "Failed to assign course." }, { status: 500 });
  }
}

// DELETE /api/admin/groups/[groupId]/courses?courseId=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;
    const { prisma } = await getTenantId();
    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

    await prisma.groupCourse.deleteMany({ where: { groupId, courseId } });
    return NextResponse.json({ removed: true });
  } catch (err) {
    console.error("[group-courses/DELETE]", err);
    return NextResponse.json({ error: "Failed to remove course." }, { status: 500 });
  }
}
