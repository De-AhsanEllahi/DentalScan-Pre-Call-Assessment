import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/messaging?threadId=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("threadId");

  if (!threadId) {
    return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
  }

  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}

// POST /api/messaging
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { threadId, patientId, content, sender } = body;

    if (!content || !sender) {
      return NextResponse.json(
        { error: "content and sender are required" },
        { status: 400 }
      );
    }

    let resolvedThreadId = threadId;

    if (!resolvedThreadId) {
      if (!patientId) {
        return NextResponse.json(
          { error: "patientId required to create a new thread" },
          { status: 400 }
        );
      }
      const thread = await prisma.thread.create({
        data: { patientId },
      });
      resolvedThreadId = thread.id;
    }

    const message = await prisma.message.create({
      data: {
        threadId: resolvedThreadId,
        content,
        sender,
      },
    });

    return NextResponse.json(
      { ok: true, message, threadId: resolvedThreadId },
      { status: 201 }
    );

  } catch (err) {
    console.error("Messaging API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}