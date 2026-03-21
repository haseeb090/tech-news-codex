import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

export function SiteFooter() {
  return (
    <footer className="shell-chrome mt-16 rounded-[2rem] border px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.32)]">
      <div className="grid gap-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <BrandMark compact />
          <p className="max-w-xl text-sm leading-7 text-slate-300">
            Rubix Signal turns publisher reporting into original, source-grounded tech briefings so readers can scan the
            story fast and then continue to the original outlet for the full article.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Product</p>
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-200">
            <Link href="/" className="hover:text-cyan-200">
              Feed
            </Link>
            <Link href="/about" className="hover:text-cyan-200">
              About & sourcing
            </Link>
            <Link href="/about" className="hover:text-cyan-200">
              How the briefings work
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Rubix Labs</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>Rubix Signal is built by Hirubix / Rubix Labs, a software studio focused on AI products and agentic orchestration systems.</p>
            <Link href="https://www.hirubix.com/" target="_blank" rel="noreferrer" className="inline-flex text-cyan-200 hover:text-cyan-100">
              Visit hirubix.com
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Editorial stance</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>We publish original rewritten briefings, not mirrored source copy.</p>
            <p>Original reporting, media, and full article rights remain with each publisher.</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5 text-xs uppercase tracking-[0.18em] text-slate-400">
        <p>Read the Rubix briefing, then continue on the publisher.</p>
        <p>Rubix Signal by Hirubix</p>
      </div>
    </footer>
  );
}
