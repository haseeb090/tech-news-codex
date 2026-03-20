import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/lib/auth/options";
import { buildArticlePreviewParagraphs, findNewsItemById } from "@/lib/news-data";

interface ArticlePageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleString();
};

const formatSourceHost = (value: string): string => {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
};

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "reader" && role !== "admin") {
    redirect(`/?auth=required&next=/articles/${id}`);
  }

  const item = await findNewsItemById(Number(id));

  if (!item) {
    notFound();
  }

  const previewParagraphs = buildArticlePreviewParagraphs(item.body, 1100, 4);
  const attributionDate = formatDate(item.publishedAt || item.createdAt);
  const sourceHost = formatSourceHost(item.url);

  return (
    <main className="mx-auto max-w-4xl space-y-8">
      <div className="feed-card glass-orbit space-y-5 rounded-[2rem] border p-8">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span>{item.source}</span>
          <span>{attributionDate}</span>
          <span>{item.primaryTopicLabel}</span>
        </div>
        <h1 className="text-4xl font-black leading-tight text-slate-900 md:text-5xl">{item.title}</h1>
        <p className="text-sm text-slate-600">{item.writer ? `By ${item.writer}` : "Writer unavailable"}</p>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-900">Publisher attribution</p>
          <p className="mt-2">
            This page shows a short, source-grounded excerpt for discovery. The original reporting, full article text, images,
            and copyright remain with {item.source}.
          </p>
          <p className="mt-2">
            Read the complete piece on the publisher&apos;s site:{" "}
            <Link href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-700 underline-offset-4 hover:underline">
              {sourceHost}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="ripple-action rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            Back to feed
          </Link>
          <Link
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="ripple-action rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Open source article
          </Link>
        </div>
      </div>

      <article className="feed-card rounded-[2rem] border p-8 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Source-grounded briefing</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">A short excerpt for fast reading</h2>
          </div>

          <div className="detail-body space-y-4 text-base leading-8 text-slate-700">
            {previewParagraphs.length > 0 ? (
              previewParagraphs.map((paragraph, index) => <p key={`${item.id}-${index}`}>{paragraph}</p>)
            ) : (
              <p>{item.excerpt}</p>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/85 p-4 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-900">Why the full article is not mirrored here</p>
            <p className="mt-2">
              Tech Radar News is designed to help readers discover reporting and then continue on the original publisher&apos;s site.
              We keep article pages attribution-first and intentionally limited to a short excerpt.
            </p>
          </div>
        </div>
      </article>
    </main>
  );
}
