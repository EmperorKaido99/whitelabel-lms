import { prisma } from "@/adapters/db";

interface AuditParams {
  action: string;
  actorId?: string;
  actorEmail?: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

export async function logAudit(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        targetId: params.targetId,
        targetType: params.targetType,
        metadata: JSON.stringify(params.metadata ?? {}),
        tenantId: params.tenantId,
      },
    });
  } catch {
    // Never let audit failures crash the app
  }
}
