import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { tenantId } = await params;
    const { prisma } = await import("@/adapters/db");

    // Cascade: delete progress → enrollments → users → courses → packages → tenant
    await prisma.$transaction([
      prisma.progress.deleteMany({ where: { enrollment: { tenantId } } }),
      prisma.enrollment.deleteMany({ where: { tenantId } }),
      prisma.module.deleteMany({ where: { tenantId } }),
      prisma.passwordResetToken.deleteMany({ where: { user: { tenantId } } }),
      prisma.user.deleteMany({ where: { tenantId } }),
      prisma.course.deleteMany({ where: { tenantId } }),
      prisma.package.deleteMany({ where: { tenantId } }),
      prisma.tenant.delete({ where: { id: tenantId } }),
    ]);

    const { logAudit } = await import("@/lib/audit");
    const actor = session.user as { id?: string; email?: string; tenantId?: string };
    await logAudit({
      action: "tenant.delete",
      actorId: actor.id,
      actorEmail: actor.email ?? undefined,
      targetId: tenantId,
      targetType: "Tenant",
      tenantId: actor.tenantId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/tenants/[tenantId] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { tenantId } = await params;
    const body = await req.json();
    const { prisma } = await import("@/adapters/db");

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.plan && { plan: body.plan }),
      },
      include: { _count: { select: { users: true, courses: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/tenants/[tenantId] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
