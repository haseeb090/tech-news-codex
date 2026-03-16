"use client";

import { useMemo, useState } from "react";

import { ArticleCard } from "@/components/news/article-card";
import type { NewsItem } from "@/lib/news-data";

interface NewsFeedClientProps {
  initialItems: NewsItem[];
  sources: string[];
}

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const tokenize = (value: string): string[] => normalize(value).split(/\s+/).filter(Boolean);

const matchesQuery = (item: NewsItem, query: string): boolean => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  const queryTokens = tokenize(query);
  const titleTokens = tokenize(item.title);
  const metaTokens = tokenize(`${item.source} ${item.writer} ${item.publishedAt}`);
  const bodyTokens = tokenize(item.body);

  return queryTokens.every((token) => {
    if (token.length <= 2) {
      return [...titleTokens, ...metaTokens, ...bodyTokens].some((candidate) => candidate === token);
    }

    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      [...titleTokens, ...metaTokens, ...bodyTokens].some(
        (candidate) => candidate === token || candidate.startsWith(token),
      )
    );
  });
};

export function NewsFeedClient({ initialItems, sources }: NewsFeedClientProps) {
  const [query, setQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");

  const filtered = useMemo(() => {
    return initialItems.filter((item) => {
      if (selectedSource !== "all" && item.source !== selectedSource) {
        return false;
      }

      return matchesQuery(item, query);
    });
  }, [initialItems, query, selectedSource]);

  return (
    <section className="space-y-8">
      <div className="grid gap-4 rounded-3xl border border-fuchsia-400/20 bg-slate-950/60 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.45)] backdrop-blur md:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Search
          <input
            className="rounded-xl border border-white/10 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none ring-fuchsia-400 transition focus:ring-2"
            placeholder="Search title, body, source, or writer..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Source
          <select
            className="rounded-xl border border-white/10 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none ring-fuchsia-400 transition focus:ring-2"
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

      <div className="flex items-center justify-between text-sm text-slate-300">
        <p>{filtered.length} articles</p>
        <p>{query ? `Searching for "${query}"` : "Showing the latest reliable extractions only"}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-fuchsia-300/30 bg-slate-950/50 p-10 text-center text-slate-300">
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
