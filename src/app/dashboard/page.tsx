import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/adapters/db";
import DashboardClient from "./DashboardClient";

interface CatalogEntry {
  id: string;
  title: string;
  description?: string;
  categories?: string[];
  prerequisites?: string[];
}

async function getLearnerData(userId: string, tenantId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, tenantId },
    include: { course: true, progress: true },
    orderBy: { createdAt: "desc" },
  });

  let catalog: Record<string, CatalogEntry> = {};
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
    const entries: CatalogEntry[] = JSON.parse(raw);
    catalog = Object.fromEntries(entries.map(e => [e.id, e]));
  } catch { /* catalog may not exist */ }

  // Build set of completed course IDs for prerequisite checking
  const completedCourseIds = new Set(
    enrollments.filter(e => e.status === "completed").map(e => e.courseId)
  );

  return enrollments.map(e => {
    const prereqs = catalog[e.courseId]?.prerequisites ?? [];
    const unmetPrereqs = prereqs
      .filter(p => !completedCourseIds.has(p))
      .map(p => ({ id: p, title: catalog[p]?.title ?? p }));

    return {
      id: e.id,
      courseId: e.courseId,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      courseTitle: catalog[e.courseId]?.title ?? e.course?.title ?? e.courseId,
      courseDescription: catalog[e.courseId]?.description,
      categories: catalog[e.courseId]?.categories ?? [],
      score: e.progress[0]?.score ?? null,
      completedAt: e.progress[0]?.completedAt?.toISOString() ?? null,
      timeSpent: e.progress[0]?.timeSpent ?? null,
      locked: unmetPrereqs.length > 0,
      unmetPrereqs,
    };
  });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const userId = session.user.id!;
  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (!tenantId) redirect("/auth");

  const learnerName = session.user.name ?? session.user.email ?? "Learner";
  const enrollments = await getLearnerData(userId, tenantId);

  return <DashboardClient enrollments={enrollments} learnerName={learnerName} />;
}
