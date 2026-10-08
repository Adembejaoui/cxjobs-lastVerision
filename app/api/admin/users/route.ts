import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Query parameters for GET /api/admin/users
 *
 * page      - 1-based page number (default 1)
 * limit     - page size, 1..100 (default 10)
 * search    - matches name OR email (case-insensitive substring)
 * role      - CANDIDATE | COMPANY
 * isActive  - "true" | "false"
 * sort      - newest | oldest | name_asc | name_desc | email_asc | email_desc
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc" | "email_asc" | "email_desc";

function parseSort(value: string | null): SortKey {
  const allowed: SortKey[] = [
    "newest",
    "oldest",
    "name_asc",
    "name_desc",
    "email_asc",
    "email_desc",
  ];
  if (value && allowed.includes(value as SortKey)) {
    return value as SortKey;
  }
  return "newest";
}

function buildOrderBy(sort: SortKey) {
  switch (sort) {
    case "oldest":
      return { createdAt: "asc" as const };
    case "name_asc":
      return { name: "asc" as const };
    case "name_desc":
      return { name: "desc" as const };
    case "email_asc":
      return { email: "asc" as const };
    case "email_desc":
      return { email: "desc" as const };
    case "newest":
    default:
      return { createdAt: "desc" as const };
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
    const rawLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT)
    );

    const search = searchParams.get("search")?.trim() || undefined;
    const role = searchParams.get("role")?.trim() || undefined;
    const isActiveParam = searchParams.get("isActive")?.trim().toLowerCase();
    const sort = parseSort(searchParams.get("sort"));

    const where: NonNullable<Parameters<typeof prisma.user.findMany>[0]>["where"] = {};

    // Only CANDIDATE and COMPANY are manageable; ADMIN accounts are excluded
    // from the listing entirely.
    where.role = { in: ["CANDIDATE", "COMPANY"] };

    if (role && (role === "CANDIDATE" || role === "COMPANY")) {
      where.role = role;
    }

    if (isActiveParam === "true") {
      where.isActive = true;
    } else if (isActiveParam === "false") {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy = buildOrderBy(sort);

    // Narrow select: never expose passwordHash, sessions, accounts, etc.
    // Include company data for COMPANY role users to avoid N+1 requests when editing.
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          companies: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              coverImageUrl: true,
              companySize: true,
              location: true,
              website: true,
              foundedYear: true,
              description: true,
              isRemoteFriendly: true,
              isHybridFriendly: true,
              linkedinUrl: true,
              twitterUrl: true,
              facebookUrl: true,
              isVerified: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch admin users", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch users", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}