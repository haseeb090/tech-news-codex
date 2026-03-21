import Parser from "rss-parser";

export interface FeedItem {
  feedUrl: string;
  link: string;
  title?: string;
}

const parser = new Parser({ timeout: 15_000 });

export const fetchFeedLinks = async (feedUrl: string): Promise<FeedItem[]> => {
  const feed = await parser.parseURL(feedUrl);
  const items = feed.items || [];

  return items
    .map((item) => ({
      feedUrl,
      link: item.link?.trim() || "",
      title: item.title?.trim() || "",
    }))
    .filter((item) => item.link.length > 0);
};
