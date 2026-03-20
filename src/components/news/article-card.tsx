"use client";

import Link from "next/link";

import type { NewsItem } from "@/lib/news-data";

interface ArticleCardProps {
  article: NewsItem;
  index: number;
  locked?: boolean;
  onOpenArticle?: () => void;
  onLockedArticleClick?: () => void;
  onLockedSourceClick?: () => void;
}

const formatDate = (value: string): string => {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleString();
};

export function ArticleCard({
  article,
  index,
  locked = false,
  onOpenArticle,
  onLockedArticleClick,
  onLockedSourceClick,
}: ArticleCardProps) {
  const updatePointer = (element: HTMLElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--pointer-x", `${clientX - rect.left}px`);
    element.style.setProperty("--pointer-y", `${clientY - rect.top}px`);
  };

  const spawnRipple = (element: HTMLElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "card-ripple";
    ripple.style.left = `${clientX - rect.left}px`;
    ripple.style.top = `${clientY - rect.top}px`;
    ripple.style.width = `${Math.max(rect.width, rect.height) * 1.15}px`;
    ripple.style.height = ripple.style.width;
    element.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  };

  return (
    <article
      className="news-card-reveal feed-card interactive-card group flex h-full flex-col rounded-3xl border p-6 transition"
      style={{ animationDelay: `${Math.min(index, 10) * 70}ms` }}
      role="link"
      tabIndex={0}
      aria-label={`Open article: ${article.title}`}
      onPointerMove={(event) => updatePointer(event.currentTarget, event.clientX, event.clientY)}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("[data-card-action='true']")) return;
        updatePointer(event.currentTarget, event.clientX, event.clientY);
        spawnRipple(event.currentTarget, event.clientX, event.clientY);
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-card-action='true']")) return;
        if (window.getSelection()?.toString()) return;
        onOpenArticle?.();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpenArticle?.();
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        <span>{article.source}</span>
        <span>{formatDate(article.publishedAt || article.createdAt)}</span>
      </div>

      {locked ? (
        <span className="mb-3 inline-flex w-fit rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-700">
          Members unlock full access
        </span>
      ) : null}

      <span className="mb-3 inline-flex w-fit rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
        {article.primaryTopicLabel}
      </span>

      <h2 className="text-xl font-bold leading-tight text-slate-900">{article.title}</h2>

      <p className="mt-4 line-clamp-5 text-sm leading-6 text-slate-700">{article.excerpt}</p>

      <div className="mt-auto pt-6">
        <p className="text-sm text-slate-500">{article.writer ? `By ${article.writer}` : "Writer unavailable"}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">Short attributed excerpt</p>
        <div className="mt-3 flex items-center gap-4">
          <Link
            href={`/articles/${article.id}`}
            data-card-action="true"
            onClick={(event) => {
              if (!locked) return;
              event.preventDefault();
              onLockedArticleClick?.();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              spawnRipple(event.currentTarget, event.clientX, event.clientY);
            }}
            className="ripple-action inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
          >
            Read here
            <span aria-hidden>{"->"}</span>
          </Link>
          <Link
            href={article.url}
            target="_blank"
            rel="noreferrer"
            data-card-action="true"
            onClick={(event) => {
              if (!locked) return;
              event.preventDefault();
              onLockedSourceClick?.();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              spawnRipple(event.currentTarget, event.clientX, event.clientY);
            }}
            className="ripple-action inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 transition group-hover:gap-3"
          >
            Open source
            <span aria-hidden>{"->"}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
