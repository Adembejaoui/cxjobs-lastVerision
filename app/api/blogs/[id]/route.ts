import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { unstable_cache } from "next/cache";
import { revalidateBlogs } from "@/lib/cache";

const updateBlogSchema = z.object({
  title: z.string().min(5).optional(),
  content: z.string().min(50).optional(),
  excerpt: z.string().max(300).optional(),
  coverImage: z.string().url().optional(),
  published: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// Cached function for fetching a single published blog
const getPublicBlog = unstable_cache(
  async (id: string) => {
    return prisma.blog.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        published: true,
      },
    });
  },
  ["public-blog"],
  { revalidate: 120, tags: ["blog"] }
);

// GET /api/blogs/[id] - Get single blog
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const isAdmin = session?.user?.role === "ADMIN";

    // For public users, use cached results for published blogs
    if (!isAdmin) {
      const blog = await getPublicBlog(id);

      if (!blog) {
        return NextResponse.json(
          { success: false, error: "Blog not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: blog,
      });
    }

    // For admins, fetch uncached results (including drafts)
    const blog = await prisma.blog.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!blog) {
      return NextResponse.json(
        { success: false, error: "Blog not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: blog,
    });
  } catch (error) {
    console.error("Get blog error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch blog", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT /api/blogs/[id] - Update blog (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const validationResult = updateBlogSchema.safeParse(body);

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

    const blog = await prisma.blog.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!blog) {
      return NextResponse.json(
        { success: false, error: "Blog not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const { published, ...updateData } = validationResult.data;

    const updatedBlog = await prisma.blog.update({
      where: { id: blog.id },
      data: {
        ...updateData,
        published,
        publishedAt:
          published && !blog.publishedAt ? new Date() : blog.publishedAt,
      },
    });

    // Revalidate blogs cache
    revalidateBlogs();

    return NextResponse.json({
      success: true,
      message: "Blog updated successfully",
      data: updatedBlog,
    });
  } catch (error) {
    console.error("Update blog error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update blog", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/blogs/[id] - Delete blog (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const blog = await prisma.blog.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!blog) {
      return NextResponse.json(
        { success: false, error: "Blog not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await prisma.blog.delete({
      where: { id: blog.id },
    });

    // Revalidate blogs cache
    revalidateBlogs();

    return NextResponse.json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Delete blog error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete blog", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
