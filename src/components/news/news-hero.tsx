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
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-50 via-white to-orange-50 p-8 shadow-[0_30px_120px_rgba(15,23,42,0.45)] md:p-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.18),transparent_28%)]" />
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-300/30 blur-2xl" />
      <div className="absolute -bottom-16 left-12 h-48 w-48 rounded-full bg-orange-300/25 blur-2xl" />
      <div className="absolute right-16 top-10 h-24 w-24 rounded-full border border-fuchsia-300/40 bg-fuchsia-300/10 blur-md" />

      <div className="relative z-10 space-y-6">
        <p className="inline-flex rounded-full border border-slate-300 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-[0_10px_30px_rgba(255,255,255,0.35)]">
          AI-Curated Tech Radar
        </p>

        <h1 className="max-w-4xl text-4xl font-black leading-[0.95] text-slate-900 md:text-7xl">
          Real tech news, extracted with grounded agents.
        </h1>

        <p className="max-w-2xl text-base leading-7 text-slate-700 md:text-xl">
          This feed blends deterministic parsing with LangGraph + Ollama fallback validation to reduce hallucinations and keep article facts grounded in source text.
        </p>

        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Articles</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{articleCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sources</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{sourceCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last Update</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(generatedAt)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
