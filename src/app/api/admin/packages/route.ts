import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_SIZE = 500 * 1024 * 1024; // 500 MB
const DEV_TENANT_ID = "dev-tenant";

interface ScormManifestInfo {
  version: "1.2" | "2004" | "unknown";
  title: string;
  entryPoint: string;
  scormFiles: number;
}

function parseManifest(xml: string): Omit<ScormManifestInfo, "scormFiles"> {
  const is2004 =
    xml.includes('schemaversion="2004"') ||
    xml.includes("scorm_2004") ||
    xml.includes("CAM 1.3") ||
    xml.includes("adlcp_rootv1p2") === false; // rough heuristic

  // Re-detect more precisely
  const version: "1.2" | "2004" | "unknown" = xml.includes("2004")
    ? "2004"
    : xml.includes("1.2") || xml.includes("adlcp_rootv1p2")
    ? "1.2"
    : "unknown";

  const titleMatch = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : "Untitled Course";

  const resourceHrefMatch = xml.match(/<resource[^>]+href="([^"]+\.html?)"/i);
  const entryPoint = resourceHrefMatch ? resourceHrefMatch[1] : "index.html";

  return { version, title, entryPoint };
}

// Lazy S3 client — only created when credentials are present
function getS3Client() {
  const keyId = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!keyId || !secret) return null;
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    credentials: { accessKeyId: keyId, secretAccessKey: secret },
  });
}

// Lazy Prisma — returns null if DATABASE_URL is not set or DB is unavailable
async function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { prisma } = await import("@/adapters/db");
    return prisma;
  } catch {
    return null;
  }
}

// Ensure dev tenant row exists so FK constraints don't fail
async function ensureDevTenant(prisma: Awaited<ReturnType<typeof getPrisma>>) {
  if (!prisma) return;
  try {
    await prisma.tenant.upsert({
      where: { slug: "dev" },
      update: {},
      create: {
        id: DEV_TENANT_ID,
        slug: "dev",
        name: "Dev Tenant",
        plan: "free",
      },
    });
  } catch (e) {
    console.warn("[scorm-upload] Could not upsert dev tenant:", e);
  }
}

// ---------------------------------------------------------------------------
// POST  /api/admin/packages
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Wrap everything so we ALWAYS return JSON — never HTML 500 pages
  try {
    // ---- Auth (optional) --------------------------------------------------
    let tenantId = DEV_TENANT_ID;
    try {
      const { auth } = await import("@/lib/auth/config");
      const session = await auth();
      if ((session?.user as { tenantId?: string })?.tenantId) {
        tenantId = (session!.user as { tenantId: string }).tenantId;
      }
    } catch {
      // No auth configured – use dev tenant
    }

    // ---- Parse multipart form ---------------------------------------------
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Could not parse form data – make sure you are sending multipart/form-data." }, { status: 400 });
    }

    const file = formData.get("package") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file received. Expected a field named 'package'." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Only .zip packages are accepted." }, { status: 422 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Package exceeds the 500 MB limit." }, { status: 413 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The uploaded file is empty." }, { status: 422 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ---- Validate SCORM manifest ------------------------------------------
    let manifestInfo: ScormManifestInfo;
    try {
      // Dynamically import JSZip so a missing/broken module surfaces cleanly
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      const manifestFile = zip.file("imsmanifest.xml");
      if (!manifestFile) {
        return NextResponse.json(
          { error: "imsmanifest.xml not found at the ZIP root. Is this a valid SCORM package?" },
          { status: 422 }
        );
      }
      const xml = await manifestFile.async("string");
      const parsed = parseManifest(xml);
      manifestInfo = { ...parsed, scormFiles: Object.keys(zip.files).length };
    } catch (zipErr) {
      console.error("[scorm-upload] ZIP error:", zipErr);
      if (zipErr instanceof Response) throw zipErr; // pass-through NextResponse
      return NextResponse.json(
        { error: "Could not read the ZIP file. Make sure it is a valid, non-corrupted archive." },
        { status: 422 }
      );
    }

    // ---- Upload to S3 (skipped when credentials absent) -------------------
    const packageId = randomUUID();
    const storageKey = `tenants/${tenantId}/packages/${packageId}/${file.name}`;
    const s3 = getS3Client();
    const BUCKET = process.env.S3_BUCKET ?? "whitelabel-lms-packages";

    if (s3) {
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: storageKey,
            Body: buffer,
            ContentType: "application/zip",
            Metadata: {
              tenantId,
              scormVersion: manifestInfo.version,
              originalName: file.name,
            },
          })
        );
      } catch (s3Err) {
        console.error("[scorm-upload] S3 error:", s3Err);
        return NextResponse.json(
          { error: "Storage upload failed. Check your S3 credentials and bucket name." },
          { status: 500 }
        );
      }
    } else {
      console.info("[scorm-upload] No S3 credentials – skipping upload, saving metadata only.");
    }

    // ---- Persist to database (skipped when DB unavailable) ----------------
    const prisma = await getPrisma();
    let packageDbId = packageId; // fallback when DB is absent

    if (prisma) {
      if (tenantId === DEV_TENANT_ID) {
        await ensureDevTenant(prisma);
      }
      try {
        const pkg = await prisma.package.create({
          data: { storageKey, version: manifestInfo.version, tenantId },
        });
        packageDbId = pkg.id;
      } catch (dbErr) {
        // Non-fatal in dev – log and continue
        console.warn("[scorm-upload] DB write failed (continuing):", dbErr);
      }
    } else {
      console.info("[scorm-upload] No DATABASE_URL – skipping DB write.");
    }

    // ---- Success ----------------------------------------------------------
    return NextResponse.json({
      packageId: packageDbId,
      storageKey,
      ...manifestInfo,
    });
  } catch (unhandled) {
    // Catch-all so we NEVER return an HTML 500 page
    console.error("[scorm-upload] Unhandled error:", unhandled);
    const message =
      unhandled instanceof Error ? unhandled.message : String(unhandled);
    return NextResponse.json(
      { error: `Unexpected server error: ${message}` },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET  /api/admin/packages
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    let tenantId = DEV_TENANT_ID;
    try {
      const { auth } = await import("@/lib/auth/config");
      const session = await auth();
      if ((session?.user as { tenantId?: string })?.tenantId) {
        tenantId = (session!.user as { tenantId: string }).tenantId;
      }
    } catch {
      // use dev tenant
    }

    const prisma = await getPrisma();
    if (!prisma) {
      return NextResponse.json([], { status: 200 });
    }

    const packages = await prisma.package.findMany({
      where: { tenantId },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(packages);
  } catch (err) {
    console.error("[scorm-packages/GET]", err);
    return NextResponse.json(
      { error: "Could not fetch packages." },
      { status: 500 }
    );
  }
}