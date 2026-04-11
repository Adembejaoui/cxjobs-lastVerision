import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/blogs/[id]/views - Increment view count
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const blog = await prisma.blog.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        published: true,
      },
    });

    if (!blog) {
      return NextResponse.json(
        { success: false, error: "Blog not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await prisma.blog.update({
      where: { id: blog.id },
      data: { views: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      message: "View count incremented",
    });
  } catch (error) {
    console.error("Increment view error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to increment view count", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
