import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import {
  validateInvitationToken,
  consumeInvitation,
  type ValidatedInvitation,
} from "@/lib/server/invitation-validation";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { runAfterResponse } from "@/lib/server/after-response";
import { issueEmailVerification, notifyExistingAccountRegistration } from "@/lib/server/account-emails";
import crypto from "crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { emailIsTaken, type EmailLookupDb } from "@/lib/server/user-email";

const REGISTER_LIMIT = { windowMs: 60_000, max: 5 };
// Bounds "account already exists" notices to one address (anti mail-bomb).
// Applied to every attempt, new or existing, so it reveals nothing.
const REGISTER_EMAIL_LIMIT = { windowMs: 60 * 60_000, max: 5 };

/**
 * Identical status and body whether the address was new or already
 * registered, so the API is not an account-existence oracle. The real owner
 * of an existing account is told by email instead.
 */
const GENERIC_REGISTER_RESPONSE = {
  success: true,
  message: "Thanks! If this email address can be used, your account is ready. Check your inbox to verify it.",
} as const;

function genericRegisterResponse() {
  return NextResponse.json(GENERIC_REGISTER_RESPONSE, { status: 201 });
}

function isUniqueEmailViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return fields.some((f) => f.includes("email"));
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimitAsync(`register:${ip}`, REGISTER_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password, name, invitationToken } = validationResult.data;

    // Server-side invitation validation: the client cannot set role, isActive,
    // or isOnboarded. These are determined solely by a successfully validated
    // invitation token.
    let invitation: ValidatedInvitation | null = null;

    if (invitationToken) {
      const result = await validateInvitationToken(invitationToken);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, code: result.code },
          { status: 400 }
        );
      }
      invitation = result.data;
    }

    const emailKey = crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
    const emailRl = await checkRateLimitAsync(`register-email:${emailKey}`, REGISTER_EMAIL_LIMIT);
    if (!emailRl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(emailRl) }
      );
    }

    // Hash BEFORE the existence check so both outcomes pay the same bcrypt
    // cost (no timing oracle).
    const passwordHash = await bcrypt.hash(password, 12);

    // `email` is already trimmed + lowercased by registerSchema. The check
    // also catches legacy mixed-case rows, so no case-variant duplicate of an
    // existing account can be created (NF-06).
    if (await emailIsTaken(prisma.user as unknown as EmailLookupDb<{ email: string }>, email)) {
      runAfterResponse("account-exists-email", () => notifyExistingAccountRegistration(email));
      return genericRegisterResponse();
    }

    let user;

    if (invitation) {
      // Normalize companyEmail from invitation for validation
      const normalizedCompanyEmail = invitation.companyEmail.trim().toLowerCase();
      const normalizedManagerEmail = invitation.managerEmail?.trim().toLowerCase() || email.trim().toLowerCase();

      // Check if companyEmail is already used by any User (including the future manager)
      if (await emailIsTaken(prisma.user as unknown as EmailLookupDb<{ email: string }>, normalizedCompanyEmail)) {
        return NextResponse.json(
          {
            success: false,
            error: "This company email is already associated with a user account.",
            code: "COMPANY_EMAIL_IN_USE",
          },
          { status: 409 }
        );
      }

      // Check if companyEmail equals managerEmail (which will become User.email)
      if (normalizedCompanyEmail === normalizedManagerEmail) {
        return NextResponse.json(
          {
            success: false,
            error: "Company email cannot be the same as the manager email.",
            code: "COMPANY_EMAIL_IN_USE",
          },
          { status: 409 }
        );
      }

      user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            name,
            role: "COMPANY" as const,
            isActive: true,
            isOnboarded: true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        });

        const { consumed } = await consumeInvitation(tx, invitation.id);
        if (!consumed) {
          throw new Error("INVITATION_ALREADY_CONSUMED");
        }

        // Create company record with invitation data
        const baseName = invitation.companyName;
        const slugBase = baseName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const generateSlug = (attempt: number): string => {
          const suffix = crypto.randomBytes(4).toString("hex");
          return attempt === 0 ? slugBase : `${slugBase}-${suffix}`;
        };
        let slug = generateSlug(0);
        let slugAttempts = 0;
        const maxSlugAttempts = 3;

        while (true) {
          try {
            await tx.companies.create({
              data: {
                userId: createdUser.id,
                name: invitation.companyName,
                slug,
                emailCompany: normalizedCompanyEmail,
              },
            });
            break;
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              const target = (error.meta?.target as string[]) || [];
              if (target.includes("slug") && slugAttempts < maxSlugAttempts) {
                slugAttempts++;
                slug = generateSlug(slugAttempts);
                continue;
              }
            }
            throw error;
          }
        }

        return createdUser;
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: "CANDIDATE" as const,
          isOnboarded: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
    }

    // Verification email is sent after the response (never blocks signup or
    // leaks provider latency). Delivery failures are logged without tokens;
    // the user can request a new link via PUT /api/auth/verify-email.
    const createdUserId = user.id;
    runAfterResponse("verification-email", () => issueEmailVerification({ id: createdUserId }));

    logger.info("USER_REGISTERED", {
      userId: user.id,
      role: user.role,
      invitationId: invitation?.id ?? null,
    });

    return genericRegisterResponse();
  } catch (error) {
    // Concurrent registration of the same address lost the race on the unique
    // index: answer exactly like the "already exists" path.
    if (isUniqueEmailViolation(error)) {
      return genericRegisterResponse();
    }
    if (
      error instanceof Error &&
      error.message === "INVITATION_ALREADY_CONSUMED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This invitation has already been used.",
          code: "TOKEN_USED",
        },
        { status: 400 }
      );
    }
    logger.error("Registration error", { error });
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred during registration",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
