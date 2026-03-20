import { hash } from "@node-rs/argon2";
import { NextRequest, NextResponse } from "next/server";

import { appConfig } from "@/lib/config";
import { checkRateLimit, createReaderUser, getReaderUserByEmail } from "@/lib/db";
import { logInfo, logWarn } from "@/lib/logger";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveIp = (request: NextRequest): string => {
  return request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
};

export async function POST(request: NextRequest) {
  if (!appConfig.publicSignupEnabled) {
    logWarn("Rejected public signup because signup is disabled");
    return NextResponse.json({ error: "Public signup is disabled." }, { status: 403 });
  }

  const ipAddress = resolveIp(request);
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string; origin?: string }
    | null;

  const email = body?.email?.trim().toLowerCase() || "";
  const password = body?.password || "";
  const origin = body?.origin?.trim() || "web";

  if (appConfig.rateLimitingEnabled && process.env.NODE_ENV === "production") {
    const rate = await checkRateLimit(
      `public-signup:${email || "unknown"}:${ipAddress}`,
      appConfig.readerSignupRateLimitAttempts,
      appConfig.readerSignupRateLimitWindowMinutes * 60 * 1000,
    );
    if (!rate.allowed) {
      logWarn("Rejected public signup due to rate limit", { email: email || "unknown", ipAddress });
      return NextResponse.json({ error: "Too many signup attempts. Please try again later." }, { status: 429 });
    }
  }

  if (!emailPattern.test(email)) {
    logWarn("Rejected public signup due to invalid email", { email });
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (password.length < 8) {
    logWarn("Rejected public signup due to short password", { email });
    return NextResponse.json({ error: "Use at least 8 characters for your password." }, { status: 400 });
  }

  const existing = await getReaderUserByEmail(email);
  if (existing) {
    logWarn("Rejected public signup because account already exists", { email });
    return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
  }

  const passwordHash = await hash(password);
  const user = await createReaderUser({
    email,
    passwordHash,
    ipAddress,
    origin,
  });
  logInfo("Created reader account", {
    userId: user.id,
    email: user.email,
    origin,
    ipAddress,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
}
