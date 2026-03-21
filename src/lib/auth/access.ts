import type { NextRequest } from "next/server";

import { appConfig } from "@/lib/config";

const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
const localIpAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export const isLocalHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  return localHostnames.has(normalized);
};

export const isLocalIpAddress = (ipAddress: string | null | undefined): boolean => {
  if (!ipAddress) return false;

  const normalized = ipAddress.split(",")[0]?.trim().toLowerCase() || "";
  return localIpAddresses.has(normalized);
};

export const isLocalRequest = (request: NextRequest): boolean => {
  if (isLocalHostname(request.nextUrl.hostname)) {
    return true;
  }

  const requestIp = (request as NextRequest & { ip?: string | null }).ip;
  if (isLocalIpAddress(requestIp)) {
    return true;
  }

  return false;
};

const parseOrigin = (value: string | null): string | null => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const isSameOriginRequest = (request: NextRequest): boolean => {
  const requestOrigin = parseOrigin(request.headers.get("origin")) || parseOrigin(request.headers.get("referer"));
  if (!requestOrigin) {
    return false;
  }

  return requestOrigin === appConfig.appOrigin;
};
