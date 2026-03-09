import { NewsFeedClient } from "@/components/news/news-feed-client";
import { NewsHero } from "@/components/news/news-hero";
import { listSources, loadNewsItems } from "@/lib/news-data";

export default async function Home() {
  const items = await loadNewsItems();
  const sources = listSources(items);
  const generatedAt = items[0]?.createdAt || new Date().toISOString();

  return (
    <main className="space-y-10">
      <NewsHero articleCount={items.length} sourceCount={sources.length} generatedAt={generatedAt} />
      <NewsFeedClient initialItems={items} sources={sources} />
    </main>
  );
}