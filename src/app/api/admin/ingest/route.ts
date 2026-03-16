import { getServerSession } from "next-auth";
import { after, NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth/options";
import { appConfig } from "@/lib/config";
import { prepareBackgroundIngestion } from "@/lib/ingestion/trigger-ingestion";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const resolveKey = (request: NextRequest, userId: string): string => {
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  return `${userId}:${forwarded}`;
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(resolveKey(request, session.user.email || "admin"), 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (process.env.NODE_ENV === "production" && !hasRemoteOllamaAccess()) {
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
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  after(async () => {
    await result.run();
  });

  return NextResponse.json({ ok: true, status: "started" }, { status: 202 });
}
