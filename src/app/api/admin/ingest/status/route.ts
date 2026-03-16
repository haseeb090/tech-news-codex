import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { getAdminDashboardData } from "@/lib/admin-dashboard";
import { authOptions } from "@/lib/auth/options";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const resolveKey = (request: NextRequest, userId: string): string => {
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  return `${userId}:${forwarded}`;
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(resolveKey(request, session.user.email || "admin"), 120, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const data = await getAdminDashboardData();
  return NextResponse.json(data);
}
