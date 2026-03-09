"use client";

import { useMemo, useState } from "react";

import { ArticleCard } from "@/components/news/article-card";
import type { NewsItem } from "@/lib/news-data";

interface NewsFeedClientProps {
  initialItems: NewsItem[];
  sources: string[];
}

export function NewsFeedClient({ initialItems, sources }: NewsFeedClientProps) {
  const [query, setQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return initialItems.filter((item) => {
      if (selectedSource !== "all" && item.source !== selectedSource) {
        return false;
      }

      if (!needle) return true;
      const haystack = `${item.title} ${item.body} ${item.writer}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [initialItems, query, selectedSource]);

  return (
    <section className="space-y-8">
      <div className="grid gap-4 rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm md:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Search
          <input
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-cyan-500 transition focus:ring-2"
            placeholder="Search title, body, or writer..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Source
          <select
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-cyan-500 transition focus:ring-2"
            value={selectedSource}
            onChange={(event) => setSelectedSource(event.target.value)}
          >
            <option value="all">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <p>{filtered.length} articles</p>
        <p>Showing the latest reliable extractions only</p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-600">
          No articles match your filters yet.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((article) => (
            <ArticleCard key={`${article.id}-${article.url}`} article={article} />
          ))}
        </div>
      )}
    </section>
  );
}