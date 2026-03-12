import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";

import { appConfig, isProduction } from "@/lib/config";
import { checkRateLimit, recordLoginAudit } from "@/lib/db";

const resolveIp = (request: unknown): string | null => {
  if (!request || typeof request !== "object" || !("headers" in request)) return null;

  const rawHeaders = (request as { headers?: unknown }).headers;
  if (!rawHeaders) return null;

  if (typeof Headers !== "undefined" && rawHeaders instanceof Headers) {
    return rawHeaders.get("x-forwarded-for") || rawHeaders.get("x-real-ip");
  }

  if (typeof rawHeaders === "object") {
    const headerMap = rawHeaders as Record<string, string | undefined>;
    return headerMap["x-forwarded-for"] || headerMap["x-real-ip"] || null;
  }

  return null;
};

export const authOptions: NextAuthOptions = {
  secret: appConfig.authSecret,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Admin",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const username = credentials?.username?.trim() || "";
        const ipAddress = resolveIp(request);

        const rate = checkRateLimit(`login:${username.toLowerCase() || "unknown"}:${ipAddress || "unknown"}`, 5, 15 * 60_000);
        if (!rate.allowed) {
          recordLoginAudit({
            username: username || "unknown",
            success: false,
            reason: "rate_limited",
            ipAddress,
          });
          return null;
        }

        if (!credentials?.username || !credentials.password) {
          recordLoginAudit({
            username: username || "unknown",
            success: false,
            reason: "missing_credentials",
            ipAddress,
          });
          return null;
        }

        if (credentials.username !== appConfig.adminUsername || !appConfig.adminPasswordHash) {
          recordLoginAudit({
            username: username,
            success: false,
            reason: "invalid_username",
            ipAddress,
          });
          return null;
        }

        const valid = await verify(appConfig.adminPasswordHash, credentials.password);
        if (!valid) {
          recordLoginAudit({
            username,
            success: false,
            reason: "invalid_password",
            ipAddress,
          });
          return null;
        }

        recordLoginAudit({
          username,
          success: true,
          reason: "authorized",
          ipAddress,
        });

        return {
          id: "admin",
          name: "Admin",
          email: "admin@local",
          role: "admin",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role || "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) || "admin";
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
};
