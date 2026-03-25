import { readFile } from "fs/promises";
import { statSync, existsSync } from "fs";
import { readdirSync } from "fs";
import path from "path";
import AdminDashboard, { type CatalogCourse, type DashboardProps } from "./AdminDashboard";

async function getDashboardData(): Promise<DashboardProps> {
  let courses: CatalogCourse[] = [];

  try {
    const raw = await readFile(path.join(process.cwd(), "data", "catalog.json"), "utf-8");
    courses = JSON.parse(raw);
  } catch {
    courses = [];
  }

  // Calculate size of each package on disk
  let totalSizeBytes = 0;
  let totalFiles = 0;

  courses = courses.map(course => {
    const scormDir = path.join(process.cwd(), "public", "scorm", course.packageId);
    let sizeBytes = 0;

    if (existsSync(scormDir)) {
      const getSize = (dir: string): number => {
        let size = 0;
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              size += getSize(full);
            } else {
              try { size += statSync(full).size; } catch { /* skip */ }
            }
          }
        } catch { /* skip */ }
        return size;
      };
      sizeBytes = getSize(scormDir);
    }

    totalSizeBytes += sizeBytes;
    totalFiles += course.fileCount;

    return { ...course, sizeBytes };
  });

  return {
    courses,
    totalFiles,
    totalSizeBytes,
    tenantSlug: process.env.TENANT_SLUG ?? "dev",
  };
}

export default async function AdminPage() {
  const data = await getDashboardData();
  return <AdminDashboard {...data} />;
}
