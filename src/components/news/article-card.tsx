import Link from "next/link";

import type { NewsItem } from "@/lib/news-data";

interface ArticleCardProps {
  article: NewsItem;
}

const formatDate = (value: string): string => {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleString();
};

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <article className="group flex h-full flex-col rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        <span>{article.source}</span>
        <span>{formatDate(article.publishedAt || article.createdAt)}</span>
      </div>

      <h2 className="text-xl font-bold leading-tight text-slate-900">{article.title}</h2>

      <p className="mt-4 line-clamp-5 text-sm leading-6 text-slate-700">{article.body}</p>

      <div className="mt-auto pt-6">
        <p className="text-sm text-slate-500">{article.writer ? `By ${article.writer}` : "Writer unavailable"}</p>
        <Link
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 transition group-hover:gap-3"
        >
          Read source
          <span aria-hidden>?</span>
        </Link>
      </div>
    </article>
  );
}