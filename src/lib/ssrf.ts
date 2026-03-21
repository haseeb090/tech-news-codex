import dns from "node:dns/promises";
import net from "node:net";

const blockedHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"]);

const isPrivateIpv4 = (ip: string): boolean => {
  const [a, b] = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const isPrivateIpv4MappedIpv6 = (ip: string): boolean => {
  if (!ip.startsWith("::ffff:")) {
    return false;
  }

  const mapped = ip.slice("::ffff:".length);
  return net.isIPv4(mapped) ? isPrivateIpv4(mapped) : false;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    isPrivateIpv4MappedIpv6(normalized)
  );
};

const isPrivateIp = (ip: string): boolean => {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true;
};

const validateRemoteUrl = async (url: string): Promise<void> => {
  const parsed = new URL(url);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Unsupported URL protocol");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (blockedHostnames.has(hostname) || hostname.endsWith(".local")) {
    throw new Error("Blocked local hostname");
  }

  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("Blocked private IP target");
  }

  let records: Array<{ address: string; family: number }> = [];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Failed DNS resolution");
  }

  if (records.length === 0) {
    throw new Error("No DNS records");
  }

  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error("Resolved to private IP target");
    }
  }
};

export const assertSafeRemoteUrl = validateRemoteUrl;

export const resolveRedirectTarget = async (currentUrl: URL, location: string): Promise<URL> => {
  const redirectTarget = new URL(location, currentUrl);
  await validateRemoteUrl(redirectTarget.toString());
  return redirectTarget;
};
