import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth/options";
import { startBackgroundIngestion } from "@/lib/ingestion/trigger-ingestion";
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

  const result = startBackgroundIngestion("manual");
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  return NextResponse.json({ ok: true, status: "started" }, { status: 202 });
}
