import type { Metadata } from "next";
import Link from "next/link";
import { Source_Serif_4, Space_Grotesk } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";
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
  description: "AI-grounded tech news extraction with LangGraph and Ollama",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${sourceSerif.variable} antialiased`}>
        <AuthProvider>
          <div className="mx-auto min-h-screen max-w-[1400px] px-4 pb-16 pt-6 md:px-10">
            <header className="mb-10 flex items-center justify-between rounded-[1.8rem] border border-fuchsia-300/15 bg-slate-950/60 px-5 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.45)] backdrop-blur-xl">
              <Link href="/" className="font-sans text-lg font-bold tracking-[0.04em] text-white">
                Tech Radar News
              </Link>
              <nav className="flex items-center gap-5 text-sm font-semibold text-slate-300">
                <Link href="/" className="hover:text-cyan-300">Feed</Link>
                <Link href="/admin" className="hover:text-fuchsia-300">Admin</Link>
              </nav>
            </header>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
