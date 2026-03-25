import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const CATALOG_PATH = path.join(process.cwd(), "data", "catalog.json");

export interface CatalogCourse {
  id: string;
  packageId: string;
  title: string;
  description?: string;
  categories?: string[];
  entryPoint: string;
  version: string;
  fileCount: number;
  publishedAt: string;
}

async function readCatalog(): Promise<CatalogCourse[]> {
  try {
    const raw = await readFile(CATALOG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeCatalog(courses: CatalogCourse[]): Promise<void> {
  const dir = path.dirname(CATALOG_PATH);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(CATALOG_PATH, JSON.stringify(courses, null, 2), "utf-8");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { packageId, title, description, categories, entryPoint, version, fileCount } = body;

    if (!packageId || !title || !entryPoint) {
      return NextResponse.json(
        { error: "Missing required fields: packageId, title, entryPoint" },
        { status: 400 }
      );
    }

    const scormDir = path.join(process.cwd(), "public", "scorm", packageId);
    if (!existsSync(scormDir)) {
      return NextResponse.json(
        { error: `SCORM files not found for package ${packageId}. Make sure the package was uploaded successfully.` },
        { status: 404 }
      );
    }

    const catalog = await readCatalog();
    const filtered = catalog.filter((c) => c.packageId !== packageId);

    const course: CatalogCourse = {
      id: packageId,
      packageId,
      title: title.trim(),
      description: description?.trim() ?? undefined,
      categories: Array.isArray(categories) ? categories : [],
      entryPoint,
      version: version ?? "unknown",
      fileCount: fileCount ?? 0,
      publishedAt: new Date().toISOString(),
    };

    filtered.push(course);
    await writeCatalog(filtered);

    // Also create/upsert Course in DB for enrollment support
    try {
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
      if (tenantId) {
        await prisma.course.upsert({
          where: { id: packageId },
          update: {
            title: course.title,
            description: course.description ?? null,
            categories: JSON.stringify(course.categories ?? []),
            status: "published",
          },
          create: {
            id: packageId,
            title: course.title,
            description: course.description ?? null,
            categories: JSON.stringify(course.categories ?? []),
            status: "published",
            tenantId,
          },
        });
      }
    } catch (dbErr) {
      console.warn("[publish] DB upsert failed (continuing):", dbErr);
    }

    return NextResponse.json({ success: true, course });
  } catch (err) {
    console.error("[publish]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to publish: ${message}` }, { status: 500 });
  }
}
