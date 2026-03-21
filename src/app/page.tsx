import { Suspense } from "react";

import { NewsFeedClient } from "@/components/news/news-feed-client";
import { NewsHero } from "@/components/news/news-hero";
import { appConfig } from "@/lib/config";
import { getNewsFeedMeta, loadFeedPage, loadNewsSnapshot } from "@/lib/news-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ generatedAt }, meta, initialFeed] = await Promise.all([
    loadNewsSnapshot(),
    getNewsFeedMeta(),
    loadFeedPage({
      offset: 0,
      limit: Math.max(appConfig.previewArticles, 24),
      sort: "newest",
    }),
  ]);

  return (
    <main id="main-content" className="space-y-10">
      <NewsHero articleCount={meta.totalArticles} sourceCount={meta.sources.length} generatedAt={generatedAt} />
      <section className="grid gap-4 md:grid-cols-3">
        <div className="feed-card rounded-[1.8rem] border p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Original rewrites</p>
          <h2 className="mt-3 text-2xl font-black text-slate-900">No publisher mirroring</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Each public article is rewritten into a fresh Rubix briefing after extraction so the feed stays useful without
            duplicating the publisher&apos;s prose.
          </p>
        </div>
        <div className="feed-card rounded-[1.8rem] border p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Multi-source signal</p>
          <h2 className="mt-3 text-2xl font-black text-slate-900">One desk, many outlets</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Rubix Signal merges multiple tech publishers into one searchable stream so readers can compare developments
            across the market without paywall hopping first.
          </p>
        </div>
        <div className="feed-card rounded-[1.8rem] border p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Built by Hirubix</p>
          <h2 className="mt-3 text-2xl font-black text-slate-900">Agentic orchestration in the wild</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            The product is a working showcase of Rubix Labs engineering: grounded extraction, validation, and editorial-style
            rewriting delivered as a free public reading experience.
          </p>
        </div>
      </section>
      <Suspense
        fallback={<div className="feed-panel rounded-3xl border p-6 text-sm text-slate-200">Loading the feed experience...</div>}
      >
        <NewsFeedClient
          initialItems={initialFeed.items}
          initialTotal={initialFeed.total}
          totalArticlesInDb={meta.totalArticles}
          sources={meta.sources}
          topics={meta.topics}
          previewCount={appConfig.previewArticles}
          viewMoreIncrement={appConfig.viewMoreIncrement}
        />
      </Suspense>
    </main>
  );
}
