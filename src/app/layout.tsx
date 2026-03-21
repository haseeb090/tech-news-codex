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
  metadataBase: new URL(appConfig.appOrigin),
  applicationName: "Rubix Signal",
  alternates: {
    canonical: "/",
  },
  title: {
    default: "Rubix Signal",
    template: "%s | Rubix Signal",
  },
  description:
    "Rubix Signal is Hirubix's free tech news desk: rewritten multi-source briefings grounded in publisher reporting and produced with an agentic extraction pipeline.",
  creator: "Hirubix",
  publisher: "Hirubix / Rubix Labs",
  keywords: [
    "Rubix Signal",
    "Hirubix",
    "Rubix Labs",
    "tech news",
    "AI news",
    "rewritten briefings",
    "agentic orchestration",
  ],
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  openGraph: {
    title: "Rubix Signal",
    description:
      "Free tech briefings from Hirubix: multi-source, source-grounded, and rewritten for fast reading.",
    locale: "en_US",
    siteName: "Rubix Signal",
    type: "website",
    url: "/",
    images: [
      {
        url: "/icon.svg",
        alt: "Rubix Signal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rubix Signal",
    description:
      "Free tech briefings from Hirubix: multi-source, source-grounded, and rewritten for fast reading.",
    images: ["/icon.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${sourceSerif.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only absolute left-4 top-4 z-[60] rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg focus:not-sr-only"
        >
          Skip to main content
        </a>
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
