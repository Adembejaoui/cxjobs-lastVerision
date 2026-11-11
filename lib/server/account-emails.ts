import prisma from "@/lib/prisma";
import { generateOneTimeToken } from "@/lib/security/one-time-token";
import { findUserByEmail, type EmailLookupDb } from "@/lib/server/user-email";
import { sendAccountExistsEmail, sendPasswordResetEmail, sendVerificationEmail, type SendResult } from "@/lib/email";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type IssueOutcome =
  | { issued: false; reason: "no_account" | "inactive" | "already_verified" }
  | { issued: true; delivery: SendResult };

/**
 * Issue a password-reset token for `email` (if an active account exists) and
 * email the link. Any previous reset token is revoked. Only the token hash is
 * stored; the raw token exists only in memory and in the email.
 */
type LookupRow = { id: string; email: string; isActive: boolean; emailVerified?: Date | null };
const users = () => prisma.user as unknown as EmailLookupDb<LookupRow>;

export async function issuePasswordReset(email: string, now = Date.now()): Promise<IssueOutcome> {
  const user = await findUserByEmail(users(), email, { id: true, email: true, isActive: true });
  if (!user) return { issued: false, reason: "no_account" };
  if (!user.isActive) return { issued: false, reason: "inactive" };

  const { token, tokenHash } = generateOneTimeToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { email: user.email, token: tokenHash, userId: user.id, expires: new Date(now + RESET_TOKEN_TTL_MS) },
    }),
  ]);
  const delivery = await sendPasswordResetEmail(user.email, token, RESET_TOKEN_TTL_MS / 60_000);
  return { issued: true, delivery };
}

/**
 * Tell the owner of an existing account that someone tried to register with
 * their address (registration answers identically either way). Only active
 * accounts are notified.
 */
export async function notifyExistingAccountRegistration(email: string): Promise<IssueOutcome> {
  const user = await findUserByEmail(users(), email, { email: true, isActive: true });
  if (!user) return { issued: false, reason: "no_account" };
  if (!user.isActive) return { issued: false, reason: "inactive" };
  return { issued: true, delivery: await sendAccountExistsEmail(user.email) };
}

/**
 * Issue an email-verification token and email the link, for an active,
 * not-yet-verified account. Previous verification tokens are revoked.
 */
export async function issueEmailVerification(
  where: { email: string } | { id: string },
  now = Date.now()
): Promise<IssueOutcome> {
  const select = { id: true, email: true, isActive: true, emailVerified: true } as const;
  const user =
    "email" in where
      ? await findUserByEmail(users(), where.email, select)
      : await prisma.user.findUnique({ where: { id: where.id }, select });
  if (!user) return { issued: false, reason: "no_account" };
  if (!user.isActive) return { issued: false, reason: "inactive" };
  if (user.emailVerified) return { issued: false, reason: "already_verified" };

  const { token, tokenHash } = generateOneTimeToken();
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationToken.create({
      data: { email: user.email, token: tokenHash, userId: user.id, expires: new Date(now + VERIFY_TOKEN_TTL_MS) },
    }),
  ]);
  const delivery = await sendVerificationEmail(user.email, token, VERIFY_TOKEN_TTL_MS / 3_600_000);
  return { issued: true, delivery };
}
