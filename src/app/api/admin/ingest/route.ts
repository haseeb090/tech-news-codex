import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth/options";
import { runIngestionPipeline } from "@/lib/ingestion/run-ingestion";
import { acquireIngestLock, isIngestRunning, releaseIngestLock } from "@/lib/ingestion/lock";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const resolveKey = (request: NextRequest, userId: string): string => {
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  return `${userId}:${forwarded}`;
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(resolveKey(request, session.user.email || "admin"), 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (isIngestRunning()) {
    return NextResponse.json({ error: "Ingestion already running" }, { status: 409 });
  }

  if (!acquireIngestLock()) {
    return NextResponse.json({ error: "Ingestion lock unavailable" }, { status: 409 });
  }

  try {
    const summary = await runIngestionPipeline({ trigger: "manual" });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  } finally {
    releaseIngestLock();
  }
}