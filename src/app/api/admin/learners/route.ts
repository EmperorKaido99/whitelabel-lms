import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

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

// GET /api/admin/learners — list all learners for the tenant
export async function GET() {
  try {
    const { prisma, tenantId } = await getPrismaAndTenant();
    if (!tenantId) return NextResponse.json({ error: "No tenant found." }, { status: 400 });

    const learners = await prisma.user.findMany({
      where: { tenantId, role: "learner" },
      orderBy: { createdAt: "desc" },
      include: {
        enrollments: {
          include: {
            course: true,
            progress: true,
          },
        },
      },
    });
    return NextResponse.json(learners);
  } catch (err) {
    console.error("[learners/GET]", err);
    return NextResponse.json({ error: "Failed to fetch learners." }, { status: 500 });
  }
}

// POST /api/admin/learners — create a new learner
export async function POST(req: NextRequest) {
  try {
    const { prisma, tenantId } = await getPrismaAndTenant();
    if (!tenantId) return NextResponse.json({ error: "No tenant found." }, { status: 400 });

    const { email, name, password } = await req.json();
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const learner = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name?.trim() ?? null,
        password: hashedPassword,
        role: "learner",
        tenantId,
      },
    });

    // Send welcome email (fire and forget)
    try {
      const { sendWelcomeEmail } = await import("@/lib/email");
      sendWelcomeEmail(learner.email, learner.name ?? learner.email).catch(() => {});
    } catch { /* email optional */ }

    // Audit log
    try {
      const { auth } = await import("@/lib/auth/config");
      const session = await auth();
      const actor = session?.user as { id?: string; email?: string; tenantId?: string } | undefined;
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ action: "learner.create", actorId: actor?.id, actorEmail: actor?.email, targetId: learner.id, targetType: "User", metadata: { email: learner.email }, tenantId });
    } catch { /* audit optional */ }

    return NextResponse.json(learner, { status: 201 });
  } catch (err: unknown) {
    console.error("[learners/POST]", err);
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A learner with this email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create learner." }, { status: 500 });
  }
}
