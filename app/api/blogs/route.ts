import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { parsePaginationParams } from "@/lib/utils";
import { unstable_cache } from "next/cache";
import { revalidateBlogs } from "@/lib/cache";

const createBlogSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  slug: z.string().min(5).regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().min(50, "Content must be at least 50 characters"),
  excerpt: z.string().max(300).optional(),
  coverImage: z.string().url().optional(),
  published: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
});

// Cached function for fetching public blogs
const getPublicBlogs = unstable_cache(
  async (filters: {
    skip: number;
    limit: number;
    tag?: string;
  }) => {
    const where: Record<string, unknown> = {
      published: true,
      ...(filters.tag && { tags: { has: filters.tag } }),
    };

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          published: true,
          publishedAt: true,
          views: true,
          tags: true,
          createdAt: true,
        },
        skip: filters.skip,
        take: filters.limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.blog.count({ where }),
    ]);

    return { blogs, total };
  },
  ["public-blogs"],
  { revalidate: 120, tags: ["blogs"] }
);

// GET /api/blogs - List blogs (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Use safe pagination with enforced limits
    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );
    
    const tag = searchParams.get("tag");

    const session = await auth();
    const isAdmin = session?.user?.role === "ADMIN";

    // For public users, use cached results
    if (!isAdmin) {
      const { blogs, total } = await getPublicBlogs({
        skip,
        limit,
        tag: tag || undefined,
      });

      return NextResponse.json({
        success: true,
        data: blogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // For admins, fetch uncached results (including drafts)
    const where: Record<string, unknown> = {
      ...(tag && { tags: { has: tag } }),
    };

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          published: true,
          publishedAt: true,
          views: true,
          tags: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.blog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: blogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get blogs error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch blogs", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/blogs - Create blog (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = createBlogSchema.safeParse(body);

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

    const { slug, published, ...blogData } = validationResult.data;

    // Generate slug from title if not provided
    const blogSlug =
      slug ||
      blogData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
        "-" +
        Date.now().toString(36);

    // Check if slug is unique
    const existingSlug = await prisma.blog.findUnique({
      where: { slug: blogSlug },
    });

    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: "A blog with this slug already exists", code: "SLUG_EXISTS" },
        { status: 400 }
      );
    }

    const blog = await prisma.blog.create({
      data: {
        ...blogData,
        slug: blogSlug,
        authorId: session.user.id,
        publishedAt: published ? new Date() : null,
      },
    });

    // Revalidate blogs cache
    revalidateBlogs();

    return NextResponse.json(
      {
        success: true,
        message: "Blog created successfully",
        data: blog,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create blog error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create blog", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
