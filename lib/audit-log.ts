import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/utils";
import { Prisma } from "@prisma/client";

export type AuditAction =
  | "USER_CREATE"
  | "USER_UPDATE"
  | "USER_DELETE"
  | "USER_ACTIVATE"
  | "USER_DEACTIVATE"
  | "USER_PASSWORD_RESET"
  | "USER_ROLE_CHANGE"
  | "COMPANY_CREATE"
  | "COMPANY_UPDATE"
  | "COMPANY_DELETE"
  | "COMPANY_APPROVE"
  | "COMPANY_SUBSCRIPTION_CHANGE"
  | "JOB_CREATE"
  | "JOB_UPDATE"
  | "JOB_DELETE"
  | "JOB_PUBLISH"
  | "JOB_ARCHIVE"
  | "JOB_REJECT"
  | "APPLICATION_STATUS_CHANGE"
  | "APPLICATION_BULK_UPDATE"
  | "SYSTEM_SETTINGS_CHANGE"
  | "INVITATION_CREATE"
  | "INVITATION_USE";

export interface AuditLogParams {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entityType,
        entityId: params.entityId,
        changes: {
          old: params.oldValues,
          new: params.newValues,
        } as Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function createAuditLogWithContext(
  adminUserId: string | undefined,
  params: Omit<AuditLogParams, "ipAddress" | "userAgent">
): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress = getClientIp(new Request("http://localhost", { headers: headersList }));
    const userAgent = headersList.get("user-agent") || undefined;

    await createAuditLog({
      ...params,
      userId: adminUserId,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to create audit log with context:", error);
  }
}

export async function getAuditLogs(params: {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}): Promise<{ logs: unknown[]; total: number }> {
  const { entityType, entityId, userId, action, startDate, endDate, page = 1, limit = 20 } = params;

  const where: Record<string, unknown> = {};

  if (entityType) where.entity = entityType;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}