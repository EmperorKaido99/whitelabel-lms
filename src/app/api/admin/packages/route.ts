import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/adapters/db";
import { auth } from "@/lib/auth/config";
import { randomUUID } from "crypto";
import JSZip from "jszip"; // add: npm i jszip @types/jszip

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.S3_BUCKET ?? "whitelabel-lms-packages";
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

interface ScormManifestInfo {
  version: "1.2" | "2004" | "unknown";
  title: string;
  entryPoint: string;
  scormFiles: number;
}

/**
 * Parse imsmanifest.xml to extract SCORM metadata.
 * Minimal regex-based parser — sufficient for standard packages.
 */
function parseManifest(xml: string): Omit<ScormManifestInfo, "scormFiles"> {
  const is2004 = xml.includes('schemaversion="2004"') || xml.includes("scorm_2004");
  const version: "1.2" | "2004" | "unknown" = is2004 ? "2004" : xml.includes("1.2") ? "1.2" : "unknown";

  const titleMatch = xml.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled Course";

  // Find first SCO launch URL
  const launchMatch =
    xml.match(/identifierref="([^"]+)"/) ??
    xml.match(/<resource[^>]+href="([^"]+)"[^>]*type="[^"]*sco[^"]*"/i);

  // Walk resources to get href
  const resourceHrefMatch = xml.match(/<resource[^>]+href="([^"]+\.html?)"/i);
  const entryPoint = resourceHrefMatch ? resourceHrefMatch[1] : "index.html";

  return { version, title, entryPoint };
}

export async function POST(req: NextRequest) {
  // Auth guard
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = session.user.tenantId as string;

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("package") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded (field: 'package')" }, { status: 400 });
  }
  if (!file.name.endsWith(".zip")) {
    return NextResponse.json({ error: "Only .zip packages are accepted" }, { status: 422 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Package exceeds 500 MB limit" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse ZIP and validate SCORM manifest
  let manifestInfo: ScormManifestInfo;
  try {
    const zip = await JSZip.loadAsync(buffer);
    const manifestFile = zip.file("imsmanifest.xml");
    if (!manifestFile) {
      return NextResponse.json(
        { error: "imsmanifest.xml not found at package root. Is this a valid SCORM package?" },
        { status: 422 }
      );
    }
    const manifestXml = await manifestFile.async("string");
    const parsed = parseManifest(manifestXml);
    manifestInfo = { ...parsed, scormFiles: Object.keys(zip.files).length };
  } catch (err) {
    console.error("[scorm-upload] ZIP parse error:", err);
    return NextResponse.json({ error: "Could not read ZIP archive" }, { status: 422 });
  }

  // Upload to S3
  const packageId = randomUUID();
  const storageKey = `tenants/${tenantId}/packages/${packageId}/${file.name}`;

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
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }

  // Persist Package record
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
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const packages = await prisma.package.findMany({
    where: { tenantId: session.user.tenantId as string },
    orderBy: { id: "desc" },
  });
  return NextResponse.json(packages);
}
