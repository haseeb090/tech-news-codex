import { NextRequest, NextResponse } from "next/server";

import { getNewsFeedMeta, loadFeedPage } from "@/lib/news-data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") || "").trim();
  const source = (searchParams.get("source") || "").trim();
  const topic = (searchParams.get("topic") || "").trim();
  const sort = (searchParams.get("sort") || "newest").trim() as "newest" | "oldest" | "title";
  const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "24", 10);

  const [{ items, total }, meta] = await Promise.all([
    loadFeedPage({
      offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 36) : 24,
      source: source && source !== "all" ? source : undefined,
      query: query || undefined,
      topic: topic && topic !== "all" ? topic : undefined,
      sort,
    }),
    getNewsFeedMeta(),
  ]);

  return NextResponse.json({
    total,
    totalArticles: meta.totalArticles,
    sources: meta.sources,
    topics: meta.topics,
    items,
  });
}
