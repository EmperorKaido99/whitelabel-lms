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

// PATCH /api/admin/groups/[groupId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const { name, description } = await req.json();
    const group = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() ?? null } : {}),
      },
    });
    if (group.tenantId !== tenantId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(group);
  } catch (err) {
    console.error("[groups/PATCH]", err);
    return NextResponse.json({ error: "Failed to update group." }, { status: 500 });
  }
}

// DELETE /api/admin/groups/[groupId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.tenantId !== tenantId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.group.delete({ where: { id: groupId } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[groups/DELETE]", err);
    return NextResponse.json({ error: "Failed to delete group." }, { status: 500 });
  }
}
