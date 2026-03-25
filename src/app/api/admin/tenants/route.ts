import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { prisma } = await import("@/adapters/db");
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, courses: true } },
      },
    });
    return NextResponse.json(tenants);
  } catch (err) {
    console.error("GET /api/admin/tenants error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { name, slug, adminEmail, adminName, adminPassword, plan } = await req.json();
    if (!name || !slug || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: "name, slug, adminEmail, adminPassword are required" }, { status: 400 });
    }

    const { prisma } = await import("@/adapters/db");

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "Slug already taken" }, { status: 409 });

    const hashed = await bcrypt.hash(adminPassword, 12);
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        plan: plan ?? "free",
        users: {
          create: {
            email: adminEmail,
            name: adminName ?? adminEmail.split("@")[0],
            password: hashed,
            role: "admin",
          },
        },
      },
      include: { _count: { select: { users: true, courses: true } } },
    });

    const { logAudit } = await import("@/lib/audit");
    const actor = session.user as { id?: string; email?: string; tenantId?: string };
    await logAudit({
      action: "tenant.create",
      actorId: actor.id,
      actorEmail: actor.email ?? undefined,
      targetId: tenant.id,
      targetType: "Tenant",
      metadata: { name, slug, adminEmail },
      tenantId: actor.tenantId,
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/tenants error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
