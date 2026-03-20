import type { Metadata } from "next";
import { Source_Serif_4, Space_Grotesk } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { appConfig } from "@/lib/config";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tech Radar News",
  description: "A modern discovery layer for tech journalism, powered by grounded extraction, attribution-first excerpts, and live subject browsing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${sourceSerif.variable} antialiased`}>
        <AuthProvider signupEnabled={appConfig.publicSignupEnabled}>
          <div className="mx-auto min-h-screen max-w-[1400px] px-4 pb-16 pt-6 md:px-10">
            <SiteHeader adminEnabled={appConfig.adminEnabled} />
            {children}
            <SiteFooter />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
