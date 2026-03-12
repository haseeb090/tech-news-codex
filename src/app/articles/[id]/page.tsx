import Link from "next/link";
import { notFound } from "next/navigation";

import { findNewsItemById, loadNewsItems } from "@/lib/news-data";

interface ArticlePageProps {
  params: Promise<{ id: string }>;
}

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleString();
};

export async function generateStaticParams() {
  const items = await loadNewsItems();
  return items.slice(0, 100).map((item) => ({ id: String(item.id) }));
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params;
  const item = await findNewsItemById(Number(id));

  if (!item) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-4 rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span>{item.source}</span>
          <span>{formatDate(item.publishedAt || item.createdAt)}</span>
        </div>
        <h1 className="text-4xl font-black leading-tight text-slate-900 md:text-5xl">{item.title}</h1>
        <p className="text-sm text-slate-600">{item.writer ? `By ${item.writer}` : "Writer unavailable"}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            Back to feed
          </Link>
          <Link
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Open source article
          </Link>
        </div>
      </div>

      <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-sm">
        <div className="prose prose-slate max-w-none text-base leading-8">
          {item.body.split(/(?<=[.!?])\s+/).map((paragraph, index) => (
            <p key={`${item.id}-${index}`}>{paragraph}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
