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

// POST /api/admin/groups/[groupId]/members — add a user to a group
export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const member = await prisma.groupMember.create({
      data: { groupId, userId, tenantId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "User is already in this group." }, { status: 409 });
    }
    console.error("[group-members/POST]", err);
    return NextResponse.json({ error: "Failed to add member." }, { status: 500 });
  }
}

// DELETE /api/admin/groups/[groupId]/members?userId=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;
    const { prisma } = await getTenantId();
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    await prisma.groupMember.deleteMany({ where: { groupId, userId } });
    return NextResponse.json({ removed: true });
  } catch (err) {
    console.error("[group-members/DELETE]", err);
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
}
