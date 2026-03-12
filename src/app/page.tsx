import { NewsFeedClient } from "@/components/news/news-feed-client";
import { NewsHero } from "@/components/news/news-hero";
import { listSources, loadNewsSnapshot } from "@/lib/news-data";

export default async function Home() {
  const { items, generatedAt } = await loadNewsSnapshot();
  const sources = listSources(items);

  return (
    <main className="space-y-10">
      <NewsHero articleCount={items.length} sourceCount={sources.length} generatedAt={generatedAt} />
      <NewsFeedClient initialItems={items} sources={sources} />
    </main>
  );
}
