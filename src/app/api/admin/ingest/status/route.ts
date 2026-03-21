import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { getAdminDashboardData } from "@/lib/admin-dashboard";
import { authOptions } from "@/lib/auth/options";
import { logInfo, logWarn } from "@/lib/logger";

export const runtime = "nodejs";

let lastStatusLogSignature = "";
let lastStatusLogAt = 0;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    logWarn("Rejected admin status request due to missing session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const data = await getAdminDashboardData();
  const signature = [
    data.activeRun?.runId || "none",
    data.activeRun?.processed || 0,
    data.activeRun?.succeeded || 0,
    data.activeRun?.failed || 0,
    data.activeRun?.currentItemUrl || "-",
    data.lastCompletedRun?.runId || "none",
    data.timelineEvents[0]?.id || "no-events",
  ].join("|");
  const now = Date.now();

  if (signature !== lastStatusLogSignature || now - lastStatusLogAt > 30_000) {
    lastStatusLogSignature = signature;
    lastStatusLogAt = now;
    logInfo("Served admin status snapshot", {
      user: session.user.email || "admin",
      activeRunId: data.activeRun?.runId || null,
      activeRunProgress: data.activeRun ? `${data.activeRun.processed}/${data.activeRun.queuedForProcessing}` : null,
      lastCompletedRunId: data.lastCompletedRun?.runId || null,
      failedLinks: data.failedLinks.length,
      recentAttempts: data.recentAttempts.length,
      timelineEvents: data.timelineEvents.length,
    });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
