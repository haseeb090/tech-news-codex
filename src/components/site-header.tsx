"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import { BrandMark } from "@/components/brand-mark";
import { publicThemes, useTheme } from "@/components/theme-provider";
import { useReaderAuth } from "@/components/reader-auth-provider";

export function SiteHeader({ adminEnabled }: { adminEnabled: boolean }) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { openReaderAuth } = useReaderAuth();

  const role = session?.user?.role;
  const canAccessReader = role === "reader" || role === "admin";

  return (
    <header className="shell-chrome glass-orbit mb-10 flex flex-wrap items-center justify-between gap-4 rounded-[1.8rem] border px-5 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.45)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-6">
        <Link href="/" aria-label="Rubix Signal home">
          <BrandMark compact />
        </Link>
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-300">
          <Link href="/" className="hover:text-cyan-300">
            Feed
          </Link>
          <Link href="/about" className="hover:text-cyan-300">
            About
          </Link>
          <Link href="https://www.hirubix.com/" target="_blank" rel="noreferrer" className="hover:text-cyan-300">
            Hirubix
          </Link>
          {adminEnabled && role === "admin" ? (
            <Link href="/admin" className="hover:text-fuchsia-300">
              Admin
            </Link>
          ) : null}
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
          Theme
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value as (typeof publicThemes)[number]["id"])}
            className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-100"
          >
            {publicThemes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {canAccessReader ? (
          <>
            <span className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100">
              {role === "admin" ? "Admin session" : session?.user?.email || "Member"}
            </span>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-300 hover:text-cyan-200"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openReaderAuth({ mode: "signin" })}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-300 hover:text-cyan-200"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => openReaderAuth({ mode: "signup" })}
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white"
            >
              Unlock full briefings
            </button>
          </>
        )}
      </div>
    </header>
  );
}
