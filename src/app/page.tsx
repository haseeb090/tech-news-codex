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
    <main className="space-y-10">
      <NewsHero articleCount={meta.totalArticles} sourceCount={meta.sources.length} generatedAt={generatedAt} />
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
