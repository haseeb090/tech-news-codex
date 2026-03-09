import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";

import { appConfig, isProduction } from "@/lib/config";

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
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) {
          return null;
        }

        if (credentials.username !== appConfig.adminUsername || !appConfig.adminPasswordHash) {
          return null;
        }

        const valid = await verify(appConfig.adminPasswordHash, credentials.password);
        if (!valid) {
          return null;
        }

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