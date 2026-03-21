import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how Rubix Signal works: multi-source discovery, grounded extraction, original rewritten briefings, and attribution-first links back to publishers.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <main id="main-content" className="mx-auto max-w-4xl space-y-8">
      <section className="hero-surface rounded-[2rem] border border-white/10 p-8 shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
        <p className="hero-chip inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
          About The Product
        </p>
        <h1 className="hero-title mt-5 text-4xl font-black md:text-6xl">Why Rubix Signal exists</h1>
        <p className="hero-subtitle mt-5 max-w-3xl text-base leading-8 md:text-lg">
          Rubix Signal exists to make quality tech reporting easier to access for free by combining multiple outlets,
          extracting the facts, and publishing original rewritten briefings that send readers back to the original source.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="feed-card rounded-[2rem] border p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Goal</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Free access to the signal</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            The product is built for readers who want fast situational awareness across AI, startups, policy, software,
            cybersecurity, and product launches without paying for every first click.
          </p>
        </div>
        <div className="feed-card rounded-[2rem] border p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Method</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Grounded rewriting</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            We extract the article, validate the facts against the retrieved source text, and then generate a fresh
            Rubix briefing in original wording so the public experience stays useful and attribution-first.
          </p>
        </div>
        <div className="feed-card rounded-[2rem] border p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Builder</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Hirubix / Rubix Labs</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Rubix Signal is built by the Hirubix team, a software studio known for shipping AI-heavy products and agentic
            orchestration systems for startups and enterprises.
          </p>
        </div>
      </section>

      <section className="feed-card rounded-[2rem] border p-8">
        <div className="space-y-6 text-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Editorial principles</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Attribution-first, but not copy-first</h2>
          </div>
          <p>
            Rubix Signal is not intended to replace the original publisher. The feed is designed as a discovery layer:
            readers get a concise original briefing and a direct route to the originating story for the full context,
            nuance, media, and publication voice.
          </p>
          <p>
            Original reporting, full article text, photos, embedded media, and copyright remain with the originating
            publisher. Every article page includes a direct link back to the source.
          </p>
          <p>
            The pipeline uses deterministic extraction, LangGraph orchestration, validation against retrieved source text,
            and an additional rewriting pass so the public-facing copy is freshly written while staying grounded in the
            verified article facts.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
            <p className="font-semibold text-slate-900">Reader expectation</p>
            <p className="mt-2">
              Use Rubix Signal for discovery, triage, and rapid scanning. Use the original publisher for the complete
              story, any visuals or embeds, and any exact wording you want to rely on.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="ripple-action rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Back to feed
            </Link>
            <Link
              href="https://www.hirubix.com/"
              target="_blank"
              rel="noreferrer"
              className="ripple-action rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Visit Hirubix
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
