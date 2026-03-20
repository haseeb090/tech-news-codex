import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

export function SiteFooter() {
  return (
    <footer className="shell-chrome mt-16 rounded-[2rem] border px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.32)]">
      <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-4">
          <BrandMark compact />
          <p className="max-w-xl text-sm leading-7 text-slate-300">
            Tech Radar News helps readers discover high-signal reporting with grounded extraction, fast subject browsing,
            and explicit links back to the original publisher.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Explore</p>
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-200">
            <Link href="/" className="hover:text-cyan-200">
              Feed
            </Link>
            <Link href="/about" className="hover:text-cyan-200">
              About & source policy
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Editorial stance</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>We show headlines and short attributed excerpts for discovery.</p>
            <p>Original reporting, images, and full article rights remain with each publisher.</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5 text-xs uppercase tracking-[0.18em] text-slate-400">
        <p>Read here, then continue on the source.</p>
        <p>Tech Radar News</p>
      </div>
    </footer>
  );
}
