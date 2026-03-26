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

// PATCH /api/admin/courses/[courseId]/modules/[moduleId]
// Accepts: { order?, content?, type? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  try {
    const { courseId, moduleId } = await params;
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const body = await req.json();
    const { order, content, type } = body;

    const updates: Record<string, unknown> = {};
    if (order !== undefined) updates.order = Number(order);
    if (type !== undefined) updates.type = type;
    if (content !== undefined) {
      updates.content = typeof content === "string" ? content : JSON.stringify(content);
    }

    const mod = await prisma.module.update({
      where: { id: moduleId },
      data: updates,
    });

    // Verify ownership
    if (mod.courseId !== courseId || mod.tenantId !== tenantId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(mod);
  } catch (err) {
    console.error("[modules/PATCH]", err);
    return NextResponse.json({ error: "Failed to update module." }, { status: 500 });
  }
}

// DELETE /api/admin/courses/[courseId]/modules/[moduleId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  try {
    const { courseId, moduleId } = await params;
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    // Verify ownership before deleting
    const mod = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod || mod.courseId !== courseId || mod.tenantId !== tenantId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.module.delete({ where: { id: moduleId } });

    // Re-sequence remaining modules so order is contiguous
    const remaining = await prisma.module.findMany({
      where: { courseId, tenantId },
      orderBy: { order: "asc" },
    });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i + 1) {
        await prisma.module.update({ where: { id: remaining[i].id }, data: { order: i + 1 } });
      }
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[modules/DELETE]", err);
    return NextResponse.json({ error: "Failed to delete module." }, { status: 500 });
  }
}
