import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/application/[id]/messages - Get messages for an application
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id: applicationId } = await params;

    // Verify the application exists and user has access
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        jobOffer: {
          select: { companyId: true }
        }
      }
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check access rights
    if (session.user.role === "CANDIDATE") {
      const candidate = await prisma.candidate.findUnique({
        where: { userId: session.user.id },
      });

      if (!candidate || candidate.id !== application.candidateId) {
        return NextResponse.json(
          { success: false, error: "Access denied", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    } else if (session.user.role === "COMPANY") {
      const company = await prisma.company.findUnique({
        where: { userId: session.user.id },
      });

      if (!company || company.id !== application.jobOffer.companyId) {
        return NextResponse.json(
          { success: false, error: "Access denied", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    // Get messages
    const messages = await prisma.applicationMessage.findMany({
      where: { applicationId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/application/[id]/messages - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id: applicationId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "Message content is required" },
        { status: 400 }
      );
    }

    // Verify the application exists and user has access
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        jobOffer: {
          select: { companyId: true }
        }
      }
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Determine sender type and verify access
    let senderType: string;
    
    if (session.user.role === "CANDIDATE") {
      const candidate = await prisma.candidate.findUnique({
        where: { userId: session.user.id },
      });

      if (!candidate || candidate.id !== application.candidateId) {
        return NextResponse.json(
          { success: false, error: "Access denied", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
      senderType = "CANDIDATE";
    } else if (session.user.role === "COMPANY" || session.user.role === "ADMIN") {
      const company = await prisma.company.findUnique({
        where: { userId: session.user.id },
      });

      if (!company || company.id !== application.jobOffer.companyId) {
        // Admin can message any application
        if (session.user.role !== "ADMIN") {
          return NextResponse.json(
            { success: false, error: "Access denied", code: "FORBIDDEN" },
            { status: 403 }
          );
        }
      }
      senderType = "USER";
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid role", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Create the message
    const message = await prisma.applicationMessage.create({
      data: {
        applicationId,
        senderId: session.user.id,
        senderType,
        content: content.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 }
    );
  }
}
