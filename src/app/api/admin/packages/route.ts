import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/adapters/db";
import { randomUUID } from "crypto";
import JSZip from "jszip";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.S3_BUCKET ?? "whitelabel-lms-packages";
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

// In dev, use a fallback tenant so the route works without a real session
const DEV_TENANT_ID = "dev-tenant";

interface ScormManifestInfo {
  version: "1.2" | "2004" | "unknown";
  title: string;
  entryPoint: string;
  scormFiles: number;
}

function parseManifest(xml: string): Omit<ScormManifestInfo, "scormFiles"> {
  const is2004 =
    xml.includes('schemaversion="2004"') || xml.includes("scorm_2004");
  const version: "1.2" | "2004" | "unknown" = is2004
    ? "2004"
    : xml.includes("1.2")
    ? "1.2"
    : "unknown";

  const titleMatch = xml.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled Course";

  const resourceHrefMatch = xml.match(
    /<resource[^>]+href="([^"]+\.html?)"/i
  );
  const entryPoint = resourceHrefMatch ? resourceHrefMatch[1] : "index.html";

  return { version, title, entryPoint };
}

export async function POST(req: NextRequest) {
  // ------------------------------------------------------------------
  // Auth: try session first; fall back to dev tenant so uploads work
  // without a login during local development.
  // ------------------------------------------------------------------
  let tenantId = DEV_TENANT_ID;

  try {
    // Dynamically import so missing config doesn't crash the whole route
    const { auth } = await import("@/lib/auth/config");
    const session = await auth();
    if (session?.user?.tenantId) {
      tenantId = session.user.tenantId as string;
    }
  } catch {
    // auth not configured / no session — continue with dev fallback
  }

  // ------------------------------------------------------------------
  // Parse multipart form
  // ------------------------------------------------------------------
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("package") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "No file uploaded (field: 'package')" },
      { status: 400 }
    );
  }
  if (!file.name.endsWith(".zip")) {
    return NextResponse.json(
      { error: "Only .zip packages are accepted" },
      { status: 422 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Package exceeds 500 MB limit" },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ------------------------------------------------------------------
  // Parse ZIP and validate SCORM manifest
  // ------------------------------------------------------------------
  let manifestInfo: ScormManifestInfo;
  try {
    const zip = await JSZip.loadAsync(buffer);
    const manifestFile = zip.file("imsmanifest.xml");
    if (!manifestFile) {
      return NextResponse.json(
        {
          error:
            "imsmanifest.xml not found at package root. Is this a valid SCORM package?",
        },
        { status: 422 }
      );
    }
    const manifestXml = await manifestFile.async("string");
    const parsed = parseManifest(manifestXml);
    manifestInfo = { ...parsed, scormFiles: Object.keys(zip.files).length };
  } catch (err) {
    console.error("[scorm-upload] ZIP parse error:", err);
    return NextResponse.json(
      { error: "Could not read ZIP archive" },
      { status: 422 }
    );
  }

  // ------------------------------------------------------------------
  // Upload to S3 (skip if credentials are not configured)
  // ------------------------------------------------------------------
  const packageId = randomUUID();
  const storageKey = `tenants/${tenantId}/packages/${packageId}/${file.name}`;

  const hasS3Config =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

  if (hasS3Config) {
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
    } catch (err) {
      console.error("[scorm-upload] S3 upload error:", err);
      return NextResponse.json(
        { error: "Storage upload failed — check S3 credentials and bucket name" },
        { status: 500 }
      );
    }
  } else {
    console.warn(
      "[scorm-upload] S3 credentials not set — skipping upload, saving metadata only"
    );
  }

  // ------------------------------------------------------------------
  // Ensure the dev tenant row exists so the FK constraint doesn't fail
  // ------------------------------------------------------------------
  if (tenantId === DEV_TENANT_ID) {
    await prisma.tenant.upsert({
      where: { id: DEV_TENANT_ID },
      update: {},
      create: {
        id: DEV_TENANT_ID,
        slug: "dev",
        name: "Dev Tenant",
        plan: "free",
      },
    });
  }

  // ------------------------------------------------------------------
  // Persist Package record
  // ------------------------------------------------------------------
  const pkg = await prisma.package.create({
    data: {
      storageKey,
      version: manifestInfo.version,
      tenantId,
    },
  });

  return NextResponse.json({
    packageId: pkg.id,
    storageKey,
    ...manifestInfo,
  });
}

/**
 * GET /api/admin/packages — list packages for the current tenant
 */
export async function GET() {
  let tenantId = DEV_TENANT_ID;

  try {
    const { auth } = await import("@/lib/auth/config");
    const session = await auth();
    if (session?.user?.tenantId) {
      tenantId = session.user.tenantId as string;
    }
  } catch {
    // fall through to dev tenant
  }

  const packages = await prisma.package.findMany({
    where: { tenantId },
    orderBy: { id: "desc" },
  });
  return NextResponse.json(packages);
}