import net from "node:net";

import type { NextRequest } from "next/server";

import { checkRateLimit as checkRateLimitInDb } from "@/lib/db";

const sanitizeKeyPart = (value: string): string => {
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return compact.slice(0, 120) || "unknown";
};

const normalizeIp = (value: string | null | undefined): string | null => {
  if (!value) return null;

  const candidate = value.split(",")[0]?.trim().toLowerCase() || "";
  if (!candidate) return null;

  if (candidate.startsWith("[")) {
    const match = candidate.match(/^\[([^[\]]+)\](?::\d+)?$/);
    if (match?.[1]) {
      return match[1];
    }
  }

  if (net.isIP(candidate)) {
    return candidate;
  }

  const parts = candidate.split(":");
  if (parts.length === 2 && /^\d+$/.test(parts[1] || "")) {
    return parts[0] || null;
  }

  return candidate;
};

const hasHeaderGetter = (value: unknown): value is { get: (name: string) => string | null } => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return typeof (value as { get?: unknown }).get === "function";
};

export const getRequestIp = (request: unknown): string | null => {
  if (!request || typeof request !== "object") return null;

  const maybeRequest = request as Partial<NextRequest> & { headers?: unknown; ip?: string | null };
  const directIp = normalizeIp(maybeRequest.ip || null);
  if (directIp) {
    return directIp;
  }

  const rawHeaders = maybeRequest.headers;
  if (!rawHeaders) return null;

  if (hasHeaderGetter(rawHeaders)) {
    return normalizeIp(rawHeaders.get("x-forwarded-for") || rawHeaders.get("x-real-ip"));
  }

  if (typeof rawHeaders === "object") {
    const headerMap = rawHeaders as unknown as Record<string, string | undefined>;
    return normalizeIp(headerMap["x-forwarded-for"] || headerMap["x-real-ip"] || null);
  }

  return null;
};

export const buildRateLimitKey = (scope: string, ...parts: Array<string | null | undefined>): string => {
  return [sanitizeKeyPart(scope), ...parts.map((part) => sanitizeKeyPart(part || "unknown"))].join(":");
};

export const checkRateLimit = checkRateLimitInDb;
