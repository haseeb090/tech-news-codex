import "@/lib/load-env";

import { appConfig } from "@/lib/config";

type CheckResult = {
  name: string;
  feedUrl: string;
  ok: boolean;
  message: string;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
  ]);
};

const extractFirstLink = (xml: string): string | null => {
  const itemMatch = xml.match(/<item[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<\/item>/i);
  if (itemMatch?.[1]) {
    return itemMatch[1].trim().replace(/<!\[CDATA\[(.*?)\]\]>/i, "$1");
  }

  const entryMatch = xml.match(/<entry[\s\S]*?<link[^>]*href=['\"]([^'\"]+)['\"][^>]*\/?>(?:<\/link>)?[\s\S]*?<\/entry>/i);
  if (entryMatch?.[1]) {
    return entryMatch[1].trim();
  }

  const fallback = xml.match(/<link>(https?:\/\/[^<]+)<\/link>/i);
  return fallback?.[1]?.trim() || null;
};

const checkFeed = async (name: string, feedUrl: string): Promise<CheckResult> => {
  try {
    const feedRes = await withTimeout(
      fetch(feedUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; TechNewsBot/1.0)" },
      }),
      10_000,
      "feed-fetch",
    );

    if (!feedRes.ok) {
      return { name, feedUrl, ok: false, message: `feed endpoint HTTP ${feedRes.status}` };
    }

    const feedType = (feedRes.headers.get("content-type") || "").toLowerCase();
    if (!(feedType.includes("xml") || feedType.includes("rss") || feedType.includes("atom"))) {
      return { name, feedUrl, ok: false, message: `feed endpoint content-type unexpected: ${feedType || "unknown"}` };
    }

    const xml = await withTimeout(feedRes.text(), 10_000, "feed-read");
    const firstLink = extractFirstLink(xml);

    if (!firstLink) {
      return { name, feedUrl, ok: false, message: "no article link found in feed xml" };
    }

    const articleRes = await withTimeout(
      fetch(firstLink, {
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; TechNewsBot/1.0)" },
      }),
      10_000,
      "article-fetch",
    );

    const articleType = (articleRes.headers.get("content-type") || "").toLowerCase();
    const htmlOk = articleType.includes("text/html") || articleType.includes("application/xhtml+xml");

    if (!articleRes.ok || !htmlOk) {
      return {
        name,
        feedUrl,
        ok: false,
        message: `first article not HTML or non-200 (${articleRes.status}, ${articleType || "unknown"})`,
      };
    }

    return { name, feedUrl, ok: true, message: "feed and first article are scrapeable" };
  } catch (error) {
    return { name, feedUrl, ok: false, message: error instanceof Error ? error.message : String(error) };
  }
};

const run = async () => {
  const results: CheckResult[] = [];

  for (const feed of appConfig.curatedRssFeeds) {
    const result = await checkFeed(feed.name, feed.feedUrl);
    results.push(result);
    console.log(`${result.ok ? "PASS" : "FAIL"} | ${feed.name} | ${result.message}`);
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\nChecked ${results.length} feeds. Passed: ${results.length - failed.length}. Failed: ${failed.length}.`);

  if (failed.length > 0) {
    process.exit(1);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
