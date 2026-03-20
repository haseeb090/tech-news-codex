import { getServerSession } from "next-auth";
import { after, NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth/options";
import { isLocalRequest } from "@/lib/auth/access";
import { appConfig } from "@/lib/config";
import { prepareBackgroundIngestion } from "@/lib/ingestion/trigger-ingestion";
import { logInfo, logWarn } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const resolveKey = (request: NextRequest, userId: string): string => {
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  return `admin-trigger:${userId}:${forwarded}`;
};

const hasRemoteOllamaAccess = (): boolean => {
  try {
    const parsed = new URL(appConfig.ollamaBaseUrl);
    const hostname = parsed.hostname.toLowerCase();
    return !["127.0.0.1", "localhost", "0.0.0.0", "::1"].includes(hostname) && !hostname.endsWith(".local");
  } catch {
    return false;
  }
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    logWarn("Rejected admin ingestion trigger due to missing session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isTrustedLocalAdmin = appConfig.adminLocalOnly && isLocalRequest(request);
  if (!isTrustedLocalAdmin && appConfig.rateLimitingEnabled) {
    const rate = await checkRateLimit(
      resolveKey(request, session.user.email || "admin"),
      appConfig.adminTriggerRateLimitAttempts,
      appConfig.adminTriggerRateLimitWindowMinutes * 60_000,
    );
    if (!rate.allowed) {
      logWarn("Rejected admin ingestion trigger due to rate limit", {
        user: session.user.email || "admin",
      });
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  if (process.env.NODE_ENV === "production" && !hasRemoteOllamaAccess()) {
    logWarn("Rejected ingestion trigger because Ollama is not remotely reachable in production");
    return NextResponse.json(
      {
        error:
          "OLLAMA_BASE_URL points to a local-only host. Run ingestion from your PC or point production to a reachable Ollama endpoint.",
      },
      { status: 503 },
    );
  }

  const result = await prepareBackgroundIngestion("manual");
  if (!result.ok) {
    logWarn("Rejected ingestion trigger because a run is already active");
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  logInfo("Accepted admin ingestion trigger", {
    user: session.user.email || "admin",
  });

  after(async () => {
    await result.run();
  });

  return NextResponse.json({ ok: true, status: "started" }, { status: 202 });
}
