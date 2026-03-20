import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-8">
      <section className="hero-surface rounded-[2rem] border border-white/10 p-8 shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
        <p className="hero-chip inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
          About The Product
        </p>
        <h1 className="hero-title mt-5 text-4xl font-black md:text-6xl">Why Tech Radar News exists</h1>
        <p className="hero-subtitle mt-5 max-w-3xl text-base leading-8 md:text-lg">
          The goal is simple: help people discover the latest tech reporting faster, with grounded extraction and clear
          attribution back to the original publisher.
        </p>
      </section>

      <section className="feed-card rounded-[2rem] border p-8">
        <div className="space-y-6 text-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Source policy</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Attribution-first by design</h2>
          </div>
          <p>
            Tech Radar News is not intended to replace the original publisher. Article cards and article detail pages show
            headlines plus short source-grounded excerpts so readers can quickly judge relevance before continuing to the
            source site.
          </p>
          <p>
            Original reporting, full article text, photos, embedded media, and copyright remain with the originating
            publisher. Every article page includes a direct link back to the source.
          </p>
          <p>
            The feed uses deterministic extraction plus LangGraph-guided validation with Ollama fallback to reduce
            hallucinations and keep surfaced details grounded in the source text that was actually retrieved.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
            <p className="font-semibold text-slate-900">Reader expectation</p>
            <p className="mt-2">
              Use Tech Radar News for discovery, triage, and quick scanning. Use the original publisher for the complete
              story, nuance, and any authoritative wording you want to rely on.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="ripple-action rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Back to feed
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
