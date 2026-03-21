import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";

import { appConfig, isProduction } from "@/lib/config";
import { checkRateLimit, getReaderUserByEmail, recordLoginAudit, updateReaderLastLoginAt } from "@/lib/db";
import { isLocalRequest } from "@/lib/auth/access";
import { buildRateLimitKey, getRequestIp } from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";

const resolveHeader = (request: unknown, headerName: string): string | null => {
  if (!request || typeof request !== "object" || !("headers" in request)) return null;

  const rawHeaders = (request as { headers?: unknown }).headers;
  if (!rawHeaders) return null;

  if (typeof Headers !== "undefined" && rawHeaders instanceof Headers) {
    return rawHeaders.get(headerName);
  }

  if (typeof rawHeaders === "object") {
    const headerMap = rawHeaders as unknown as Record<string, string | undefined>;
    return headerMap[headerName] || headerMap[headerName.toLowerCase()] || null;
  }

  return null;
};

const isLocalAdminRequest = (request: unknown): boolean => {
  if (!request || typeof request !== "object" || !("nextUrl" in request) || !("headers" in request)) {
    return false;
  }

  return isLocalRequest(request as Parameters<typeof isLocalRequest>[0]);
};

export const authOptions: NextAuthOptions = {
  secret: appConfig.authSecret,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  useSecureCookies: isProduction && appConfig.appUrlIsHttps,
  providers: [
    ...(appConfig.adminEnabled
      ? [
          CredentialsProvider({
            id: "admin-credentials",
            name: "Admin",
            credentials: {
              username: { label: "Username", type: "text" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials, request) {
              const username = credentials?.username?.trim() || "";
              const ipAddress = getRequestIp(request);
              const isTrustedLocalAdmin = appConfig.adminLocalOnly && isLocalAdminRequest(request);
              logInfo("Admin auth attempt received", {
                username: username || "unknown",
                ipAddress: ipAddress || "unknown",
                trustedLocalAdmin: isTrustedLocalAdmin,
                host: resolveHeader(request, "host"),
              });

              if (!appConfig.adminEnabled) {
                logWarn("Admin auth rejected because admin access is disabled", {
                  username: username || "unknown",
                  ipAddress: ipAddress || "unknown",
                });
                await recordLoginAudit({
                  username: username || "unknown",
                  success: false,
                  reason: "admin_disabled",
                  ipAddress,
                });
                return null;
              }

              if (appConfig.adminLocalOnly && !isTrustedLocalAdmin) {
                logWarn("Admin auth rejected because request is not local", {
                  username: username || "unknown",
                  ipAddress: ipAddress || "unknown",
                  host: resolveHeader(request, "host"),
                });
                await recordLoginAudit({
                  username: username || "unknown",
                  success: false,
                  reason: "not_local",
                  ipAddress,
                });
                return null;
              }

              if (!isTrustedLocalAdmin && appConfig.rateLimitingEnabled) {
                const rate = await checkRateLimit(
                  buildRateLimitKey("login", username.toLowerCase() || "unknown", ipAddress || "unknown"),
                  5,
                  15 * 60_000,
                );
                if (!rate.allowed) {
                  logWarn("Admin auth blocked by rate limit", {
                    username: username || "unknown",
                    ipAddress: ipAddress || "unknown",
                  });
                  await recordLoginAudit({
                    username: username || "unknown",
                    success: false,
                    reason: "rate_limited",
                    ipAddress,
                  });
                  return null;
                }
              }

              if (!credentials?.username || !credentials.password) {
                logWarn("Admin auth rejected due to missing credentials", {
                  username: username || "unknown",
                  ipAddress: ipAddress || "unknown",
                });
                await recordLoginAudit({
                  username: username || "unknown",
                  success: false,
                  reason: "missing_credentials",
                  ipAddress,
                });
                return null;
              }

              if (credentials.username !== appConfig.adminUsername || !appConfig.adminPasswordHash) {
                logWarn("Admin auth rejected due to invalid username or missing hash", {
                  username: username || "unknown",
                  expectedUsername: appConfig.adminUsername,
                  hasPasswordHash: Boolean(appConfig.adminPasswordHash),
                  ipAddress: ipAddress || "unknown",
                });
                await recordLoginAudit({
                  username: username,
                  success: false,
                  reason: "invalid_username",
                  ipAddress,
                });
                return null;
              }

              const valid = await verify(appConfig.adminPasswordHash, credentials.password);
              if (!valid) {
                logWarn("Admin auth rejected due to invalid password", {
                  username,
                  ipAddress: ipAddress || "unknown",
                });
                await recordLoginAudit({
                  username,
                  success: false,
                  reason: "invalid_password",
                  ipAddress,
                });
                return null;
              }

              await recordLoginAudit({
                username,
                success: true,
                reason: "authorized",
                ipAddress,
              });
              logInfo("Admin auth succeeded", {
                username,
                ipAddress: ipAddress || "unknown",
              });

              return {
                id: "admin",
                name: "Admin",
                email: "admin@local",
                role: "admin",
              };
            },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "reader-credentials",
      name: "Reader",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email?.trim().toLowerCase() || "";
        const ipAddress = getRequestIp(request);
        logInfo("Reader auth attempt received", {
          email: email || "unknown",
          ipAddress: ipAddress || "unknown",
        });

        if (appConfig.rateLimitingEnabled && isProduction) {
          const rate = await checkRateLimit(
            buildRateLimitKey("reader-login", email || "unknown", ipAddress || "unknown"),
            appConfig.readerLoginRateLimitAttempts,
            appConfig.readerLoginRateLimitWindowMinutes * 60_000,
          );
          if (!rate.allowed) {
            logWarn("Reader auth blocked by rate limit", {
              email: email || "unknown",
              ipAddress: ipAddress || "unknown",
            });
            return null;
          }
        }

        if (!credentials?.email || !credentials.password) {
          logWarn("Reader auth rejected due to missing credentials", {
            email: email || "unknown",
            ipAddress: ipAddress || "unknown",
          });
          return null;
        }

        const user = await getReaderUserByEmail(email);
        if (!user) {
          logWarn("Reader auth rejected because account was not found", {
            email,
            ipAddress: ipAddress || "unknown",
          });
          return null;
        }

        const valid = await verify(user.passwordHash, credentials.password);
        if (!valid) {
          logWarn("Reader auth rejected due to invalid password", {
            email,
            ipAddress: ipAddress || "unknown",
          });
          return null;
        }

        await updateReaderLastLoginAt(user.id);
        logInfo("Reader auth succeeded", {
          email,
          userId: user.id,
          ipAddress: ipAddress || "unknown",
        });

        return {
          id: String(user.id),
          name: email.split("@")[0] || "Reader",
          email,
          role: "reader",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role || "admin";
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) || "admin";
        session.user.id = token.userId as string | undefined;
      }
      return session;
    },
  },
  events: {
    async signIn(message) {
      logInfo("NextAuth sign-in completed", {
        provider: message.account?.provider || "unknown",
        role: (message.user as { role?: string } | undefined)?.role || "unknown",
        userId: message.user.id || null,
      });
    },
    async signOut(message) {
      logInfo("NextAuth sign-out completed", {
        sessionToken: message.token?.sub || null,
      });
    },
  },
  logger: {
    error(code, metadata) {
      logError(`NextAuth error: ${code}`, metadata);
    },
    warn(code) {
      logWarn(`NextAuth warning: ${code}`);
    },
    debug(code, metadata) {
      logInfo(`NextAuth debug: ${code}`, metadata);
    },
  },
  cookies: {
    sessionToken: {
      name: isProduction && appConfig.appUrlIsHttps
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction && appConfig.appUrlIsHttps,
      },
    },
  },
};
