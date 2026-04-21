import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const AUTO_REPLY_TEXT =
  "Thanks for reaching out! 👋 We've received your message and a member of our team will get back to you shortly. If your question is urgent, please call our clinic directly.";

// Fires after the response is sent — does not block the patient
async function sendAutoReply(threadId: string) {
  // Small delay so the auto-reply feels like a real person typing
  await new Promise((resolve) => setTimeout(resolve, 1500));
  try {
    await prisma.message.create({
      data: {
        threadId,
        content: AUTO_REPLY_TEXT,
        sender: "dentist",
      },
    });
    console.log(`[AutoReply] ✅ Sent for thread: ${threadId}`);
  } catch (err) {
    console.error("[AutoReply] ❌ Failed:", err);
  }
}

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
    const isNewThread = !resolvedThreadId;

    if (isNewThread) {
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

    // Fire auto-reply only on the very first message of a new thread
    if (isNewThread) {
      sendAutoReply(resolvedThreadId); // no await — non-blocking
    }

    return NextResponse.json(
      { ok: true, message, threadId: resolvedThreadId },
      { status: 201 }
    );

  } catch (err) {
    console.error("Messaging API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}