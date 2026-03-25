import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const CATALOG_PATH = path.join(process.cwd(), "data", "catalog.json");

export interface CatalogCourse {
  id: string;
  packageId: string;
  title: string;
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
    const { packageId, title, entryPoint, version, fileCount } = body;

    if (!packageId || !title || !entryPoint) {
      return NextResponse.json(
        { error: "Missing required fields: packageId, title, entryPoint" },
        { status: 400 }
      );
    }

    // Verify the SCORM files were extracted
    const scormDir = path.join(process.cwd(), "public", "scorm", packageId);
    if (!existsSync(scormDir)) {
      return NextResponse.json(
        {
          error: `SCORM files not found for package ${packageId}. Make sure the package was uploaded successfully.`,
        },
        { status: 404 }
      );
    }

    const catalog = await readCatalog();

    // Remove existing entry for this packageId if re-publishing
    const filtered = catalog.filter((c) => c.packageId !== packageId);

    const course: CatalogCourse = {
      id: packageId,
      packageId,
      title: title.trim(),
      entryPoint,
      version: version ?? "unknown",
      fileCount: fileCount ?? 0,
      publishedAt: new Date().toISOString(),
    };

    filtered.push(course);
    await writeCatalog(filtered);

    return NextResponse.json({ success: true, course });
  } catch (err) {
    console.error("[publish]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to publish: ${message}` },
      { status: 500 }
    );
  }
}
