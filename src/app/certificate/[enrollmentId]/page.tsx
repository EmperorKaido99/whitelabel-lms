import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/adapters/db";
import CertificatePage from "./CertificatePage";

export default async function CertificateRoute({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const { enrollmentId } = await params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: true,
      course: true,
      progress: true,
    },
  });

  if (!enrollment) notFound();

  // Only the learner themselves (or admins) can view their certificate
  const sessionRole = (session.user as { role?: string }).role;
  if (enrollment.userId !== session.user.id && sessionRole !== "admin") {
    redirect("/dashboard");
  }

  if (enrollment.status !== "completed") {
    redirect("/dashboard");
  }

  // Try to get course title from catalog
  let courseTitle = enrollment.course?.title ?? enrollment.courseId;
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
    const catalog: { id: string; title: string }[] = JSON.parse(raw);
    const entry = catalog.find(c => c.id === enrollment.courseId);
    if (entry) courseTitle = entry.title;
  } catch { /* catalog optional */ }

  const completedAt = enrollment.progress[0]?.completedAt?.toISOString() ?? new Date().toISOString();
  const score = enrollment.progress[0]?.score ?? null;
  const learnerName = enrollment.user?.name ?? enrollment.user?.email ?? "Learner";

  return (
    <CertificatePage
      enrollmentId={enrollmentId}
      learnerName={learnerName}
      courseTitle={courseTitle}
      completedAt={completedAt}
      score={score}
    />
  );
}
