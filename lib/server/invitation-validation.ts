import crypto from "crypto";
import prisma from "@/lib/prisma";
import { type CompanyInvitationStatus } from "@/lib/validations/company-invitation";
import { type Prisma } from "@/app/generated/prisma/client";

export type EligibleInvitationStatus = "PENDING" | "IN_PROGRESS";

export type InvitationStatus = CompanyInvitationStatus;

export interface ValidatedInvitation {
  id: string;
  companyName: string;
  companyEmail: string;
  managerName: string | null;
  managerEmail: string | null;
  expiresAt: Date;
  status: InvitationStatus;
  revokedAt: Date | null;
  usedAt: Date | null;
}

export type InvitationValidationError =
  | "TOKEN_MISSING"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "TOKEN_USED"
  | "TOKEN_INELIGIBLE";

export interface InvalidInvitation {
  success: false;
  error: string;
  code: InvitationValidationError;
}

export interface ValidInvitation {
  success: true;
  data: ValidatedInvitation;
}

export type InvitationValidationResult = ValidInvitation | InvalidInvitation;

const ELIGIBLE_STATUSES: readonly EligibleInvitationStatus[] = [
  "PENDING",
  "IN_PROGRESS",
];

const ERROR_MESSAGES: Record<InvitationValidationError, string> = {
  TOKEN_MISSING: "Invitation token is required.",
  INVALID_TOKEN: "This invitation link is invalid.",
  TOKEN_EXPIRED: "This invitation has expired.",
  TOKEN_REVOKED: "This invitation has been revoked.",
  TOKEN_USED: "This invitation has already been used.",
  TOKEN_INELIGIBLE: "This invitation is no longer available for registration.",
};

function hashToken(rawToken: string): string {
  return crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
}

/**
 * Validates a raw invitation token server-side.
 *
 * The raw token is never logged or persisted. Only the SHA-256 hash is
 * queried against the database. The returned metadata excludes `tokenHash`.
 */
export async function validateInvitationToken(
  rawToken: string
): Promise<InvitationValidationResult> {
  if (!rawToken || rawToken.trim().length === 0) {
    return {
      success: false,
      error: ERROR_MESSAGES.TOKEN_MISSING,
      code: "TOKEN_MISSING",
    };
  }

  const tokenHash = hashToken(rawToken);

  const invitation = await prisma.companyInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      companyName: true,
      companyEmail: true,
      managerName: true,
      managerEmail: true,
      expiresAt: true,
      status: true,
      revokedAt: true,
      usedAt: true,
    },
  });

  if (!invitation) {
    return {
      success: false,
      error: ERROR_MESSAGES.INVALID_TOKEN,
      code: "INVALID_TOKEN",
    };
  }

  if (invitation.revokedAt) {
    return {
      success: false,
      error: ERROR_MESSAGES.TOKEN_REVOKED,
      code: "TOKEN_REVOKED",
    };
  }

  if (invitation.usedAt) {
    return {
      success: false,
      error: ERROR_MESSAGES.TOKEN_USED,
      code: "TOKEN_USED",
    };
  }

  if (invitation.expiresAt < new Date()) {
    return {
      success: false,
      error: ERROR_MESSAGES.TOKEN_EXPIRED,
      code: "TOKEN_EXPIRED",
    };
  }

  if (!ELIGIBLE_STATUSES.includes(invitation.status as EligibleInvitationStatus)) {
    if (invitation.status === "CREATED" || invitation.status === "CLOSED") {
      return {
        success: false,
        error: ERROR_MESSAGES.TOKEN_USED,
        code: "TOKEN_USED",
      };
    }
    return {
      success: false,
      error: ERROR_MESSAGES.TOKEN_INELIGIBLE,
      code: "TOKEN_INELIGIBLE",
    };
  }

  return {
    success: true,
    data: invitation,
  };
}

/**
 * Atomically consumes a verified invitation, transitioning its status from
 * PENDING/IN_PROGRESS to CREATED and recording `usedAt`.
 *
 * The `where` clause guards against races: if another request already
 * consumed the invitation (status changed, usedAt set), the update affects
 * zero rows and the caller must roll back.
 */
export async function consumeInvitation(
  tx: Prisma.TransactionClient,
  invitationId: string,
  eligibleStatuses: readonly EligibleInvitationStatus[] = ELIGIBLE_STATUSES
): Promise<{ consumed: boolean }> {
  const now = new Date();
  const result = await tx.companyInvitation.updateMany({
    where: {
      id: invitationId,
      status: { in: eligibleStatuses as CompanyInvitationStatus[] },
      usedAt: null,
      revokedAt: null,
      expiresAt: { gte: now },
    },
    data: {
      status: "CREATED",
      usedAt: now,
    },
  });

  return { consumed: result.count > 0 };
}
