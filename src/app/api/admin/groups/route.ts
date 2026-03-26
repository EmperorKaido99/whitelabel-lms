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

// GET /api/admin/groups — list groups with member/course counts
export async function GET() {
  try {
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const groups = await prisma.group.findMany({
      where: { tenantId },
      include: {
        _count: { select: { members: true, courses: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        courses: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(groups);
  } catch (err) {
    console.error("[groups/GET]", err);
    return NextResponse.json({ error: "Failed to fetch groups." }, { status: 500 });
  }
}

// POST /api/admin/groups — create a group
export async function POST(req: NextRequest) {
  try {
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const { name, description } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Group name is required." }, { status: 400 });

    const group = await prisma.group.create({
      data: { name: name.trim(), description: description?.trim() ?? null, tenantId },
    });
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    console.error("[groups/POST]", err);
    return NextResponse.json({ error: "Failed to create group." }, { status: 500 });
  }
}
