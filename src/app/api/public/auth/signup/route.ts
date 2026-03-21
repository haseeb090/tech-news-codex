import { hash } from "@node-rs/argon2";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { appConfig } from "@/lib/config";
import { createReaderUser, getReaderUserByEmail } from "@/lib/db";
import { logInfo, logWarn } from "@/lib/logger";
import { buildRateLimitKey, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  origin: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-z0-9._-]+$/i)
    .optional(),
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveIp = (request: NextRequest): string => {
  return getRequestIp(request) || "unknown";
};

export async function POST(request: NextRequest) {
  if (!appConfig.publicSignupEnabled) {
    logWarn("Rejected public signup because signup is disabled");
    return NextResponse.json({ error: "Public signup is disabled." }, { status: 403 });
  }

  const ipAddress = resolveIp(request);
  const contentLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    logWarn("Rejected public signup due to invalid payload", {
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "body"),
    });
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const origin = parsed.data.origin || "web";

  if (appConfig.rateLimitingEnabled && process.env.NODE_ENV === "production") {
    const rate = await checkRateLimit(
      buildRateLimitKey("public-signup", email || "unknown", ipAddress),
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
