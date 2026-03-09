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
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-gradient-to-br from-cyan-50 via-white to-orange-50 p-8 shadow-lg md:p-12">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-300/30 blur-2xl" />
      <div className="absolute -bottom-16 left-12 h-48 w-48 rounded-full bg-orange-300/25 blur-2xl" />

      <div className="relative z-10 space-y-6">
        <p className="inline-flex rounded-full border border-slate-300 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
          AI-Curated Tech Radar
        </p>

        <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-900 md:text-6xl">
          Real tech news, extracted with grounded agents.
        </h1>

        <p className="max-w-2xl text-base leading-7 text-slate-700 md:text-lg">
          This feed blends deterministic parsing with LangGraph + Ollama fallback validation to reduce hallucinations and keep article facts grounded in source text.
        </p>

        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Articles</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{articleCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sources</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{sourceCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last Update</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(generatedAt)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}