"use client";

import { SessionProvider } from "next-auth/react";

import { ReaderAuthProvider } from "@/components/reader-auth-provider";
import { ThemeProvider } from "@/components/theme-provider";

export function AuthProvider({
  children,
  signupEnabled,
}: {
  children: React.ReactNode;
  signupEnabled: boolean;
}) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ReaderAuthProvider signupEnabled={signupEnabled}>{children}</ReaderAuthProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
