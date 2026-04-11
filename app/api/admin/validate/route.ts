import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: "Missing type or id" },
        { status: 400 }
      );
    }

    let exists = false;
    let details = null;

    switch (type) {
      case "user":
        exists = await prisma.user.findUnique({ where: { id } }) !== null;
        if (exists) {
          const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, role: true },
          });
          details = user;
        }
        break;
      case "company":
        exists = await prisma.company.findUnique({ where: { id } }) !== null;
        if (exists) {
          const company = await prisma.company.findUnique({
            where: { id },
            select: { id: true, name: true, isVerified: true },
          });
          details = company;
        }
        break;
      case "job":
        exists = await prisma.jobOffer.findUnique({ where: { id } }) !== null;
        if (exists) {
          const job = await prisma.jobOffer.findUnique({
            where: { id },
            select: { id: true, title: true, status: true },
          });
          details = job;
        }
        break;
      case "application":
        exists = await prisma.application.findUnique({ where: { id } }) !== null;
        if (exists) {
          const application = await prisma.application.findUnique({
            where: { id },
            select: { id: true, status: true },
          });
          details = application;
        }
        break;
      default:
        return NextResponse.json(
          { error: "Invalid type" },
          { status: 400 }
        );
    }

    return NextResponse.json({ exists, details });
  } catch (error) {
    console.error("Error validating:", error);
    return NextResponse.json(
      { error: "Failed to validate" },
      { status: 500 }
    );
  }
}