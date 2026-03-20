import type { NextRequest } from "next/server";
import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth/options";
import { logInfo } from "@/lib/logger";

const handler = NextAuth(authOptions);

const logAuthRequest = (request: NextRequest) => {
  logInfo("Received NextAuth request", {
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });
};

export async function GET(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  logAuthRequest(request);
  return handler(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  logAuthRequest(request);
  return handler(request, context);
}
