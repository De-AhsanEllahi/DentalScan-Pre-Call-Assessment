import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function createNotification(scanId: string) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: "clinic_default",
        title: "New Scan Ready for Review",
        message: `Scan ${scanId} has been completed and is ready for diagnosis.`,
        read: false,
      },
    });

    // Simulated Twilio/Telnyx — no real credentials needed
    console.log(`[Notification] ✅ Saved to DB for scan: ${scanId}`);
    console.log(`[Twilio STUB]   SMS sent to clinic for scan: ${scanId} - Message: ${notification.message}`);
  } catch (err) {
    // Non-blocking — log but don't crash
    console.error("[Notification] ❌ Failed to save:", err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scanId, status } = body;

    if (!scanId) {
      return NextResponse.json({ error: "scanId is required" }, { status: 400 });
    }

    if (status === "completed") {
      createNotification(scanId);

      return NextResponse.json({
        ok: true,
        message: "Scan received. Clinic notification dispatched.",
      });
    }

    return NextResponse.json({ ok: true, message: "No action taken." });

  } catch (err) {
    console.error("Notification API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  const notifications = await prisma.notification.findMany({
    where: { read: false },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notifications });
}