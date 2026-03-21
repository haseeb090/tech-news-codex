import Link from "next/link";

interface NewsHeroProps {
  articleCount: number;
  sourceCount: number;
  generatedAt: string;
}

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
};

export function NewsHero({ articleCount, sourceCount, generatedAt }: NewsHeroProps) {
  return (
    <section className="hero-surface relative overflow-hidden rounded-[2rem] border border-white/10 p-8 shadow-[0_30px_120px_rgba(15,23,42,0.45)] md:p-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.18),transparent_28%)]" />
      <div className="hero-orb-primary absolute -right-12 -top-12 h-40 w-40 rounded-full blur-2xl" />
      <div className="hero-orb-secondary absolute -bottom-16 left-12 h-48 w-48 rounded-full blur-2xl" />
      <div className="hero-ring absolute right-16 top-10 h-24 w-24 rounded-full border border-fuchsia-300/40 blur-md" />

      <div className="relative z-10 space-y-6">
        <p className="hero-chip inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-[0_10px_30px_rgba(255,255,255,0.35)]">
          Rubix Labs x Hirubix News Desk
        </p>

        <h1 className="hero-title max-w-4xl text-4xl font-black leading-[0.95] md:text-7xl">
          Free tech briefings, rewritten from the source.
        </h1>

        <p className="hero-subtitle max-w-2xl text-base leading-7 md:text-xl">
          Rubix Signal combines multiple publishers, agentic extraction, and grounded rewrites to produce original briefings that stay faithful to the facts without mirroring the article text.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/about"
            className="ripple-action rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]"
          >
            How it works
          </Link>
          <Link
            href="https://www.hirubix.com/"
            target="_blank"
            rel="noreferrer"
            className="ripple-action rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800"
          >
            Meet Hirubix
          </Link>
        </div>

        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div className="hero-stat rounded-2xl border border-slate-200 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Briefings</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{articleCount}</p>
          </div>
          <div className="hero-stat rounded-2xl border border-slate-200 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sources</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{sourceCount}</p>
          </div>
          <div className="hero-stat rounded-2xl border border-slate-200 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last Update</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(generatedAt)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
