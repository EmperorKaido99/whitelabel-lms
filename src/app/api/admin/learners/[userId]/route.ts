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

// DELETE /api/admin/learners/[userId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { prisma, tenantId } = await getPrismaAndTenant();
    if (!tenantId) return NextResponse.json({ error: "No tenant found." }, { status: 400 });

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) return NextResponse.json({ error: "Learner not found." }, { status: 404 });

    // Delete enrollments and progress first
    const enrollments = await prisma.enrollment.findMany({ where: { userId, tenantId } });
    for (const e of enrollments) {
      await prisma.progress.deleteMany({ where: { enrollmentId: e.id } });
    }
    await prisma.enrollment.deleteMany({ where: { userId, tenantId } });
    await prisma.user.delete({ where: { id: userId } });

    try {
      const { auth } = await import("@/lib/auth/config");
      const session = await auth();
      const actor = session?.user as { id?: string; email?: string; tenantId?: string } | undefined;
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ action: "learner.delete", actorId: actor?.id, actorEmail: actor?.email, targetId: userId, targetType: "User", metadata: { email: user.email }, tenantId: tenantId ?? undefined });
    } catch { /* audit optional */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[learners/DELETE]", err);
    return NextResponse.json({ error: "Failed to delete learner." }, { status: 500 });
  }
}

// PATCH /api/admin/learners/[userId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { prisma, tenantId } = await getPrismaAndTenant();
    if (!tenantId) return NextResponse.json({ error: "No tenant found." }, { status: 400 });

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) return NextResponse.json({ error: "Learner not found." }, { status: 404 });

    const { name, email } = await req.json();
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[learners/PATCH]", err);
    return NextResponse.json({ error: "Failed to update learner." }, { status: 500 });
  }
}
