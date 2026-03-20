import type { NextRequest } from "next/server";

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

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(":")[0]?.trim().toLowerCase() || "";
    if (isLocalHostname(host)) {
      return true;
    }
  }

  return false;
};
