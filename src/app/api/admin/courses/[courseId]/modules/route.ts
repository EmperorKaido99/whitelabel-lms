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

// GET /api/admin/courses/[courseId]/modules
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const modules = await prisma.module.findMany({
      where: { courseId, tenantId },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(modules);
  } catch (err) {
    console.error("[modules/GET]", err);
    return NextResponse.json({ error: "Failed to fetch modules." }, { status: 500 });
  }
}

// POST /api/admin/courses/[courseId]/modules — add a module
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const { prisma, tenantId } = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const body = await req.json();
    const { type = "scorm", content = {} } = body;

    // Determine next order value
    const last = await prisma.module.findFirst({
      where: { courseId, tenantId },
      orderBy: { order: "desc" },
    });
    const order = (last?.order ?? 0) + 1;

    const mod = await prisma.module.create({
      data: {
        courseId,
        tenantId,
        order,
        type,
        content: typeof content === "string" ? content : JSON.stringify(content),
      },
    });

    return NextResponse.json(mod, { status: 201 });
  } catch (err) {
    console.error("[modules/POST]", err);
    return NextResponse.json({ error: "Failed to create module." }, { status: 500 });
  }
}
