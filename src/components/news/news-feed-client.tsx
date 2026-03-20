"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import { ArticleCard } from "@/components/news/article-card";
import { useReaderAuth } from "@/components/reader-auth-provider";
import type { NewsItem } from "@/lib/news-data";

interface NewsFeedClientProps {
  initialItems: NewsItem[];
  initialTotal: number;
  totalArticlesInDb: number;
  sources: string[];
  topics: Array<{ id: string; label: string }>;
  previewCount: number;
  viewMoreIncrement: number;
}

interface NewsApiPayload {
  items: NewsItem[];
  total: number;
}

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const apiPageSize = 24;

export function NewsFeedClient({
  initialItems,
  initialTotal,
  totalArticlesInDb,
  sources,
  topics,
  previewCount,
  viewMoreIncrement,
}: NewsFeedClientProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openReaderAuth, isAuthenticated } = useReaderAuth();
  const [query, setQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "title">("newest");
  const [items, setItems] = useState<NewsItem[]>(initialItems);
  const [filteredTotal, setFilteredTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length < initialTotal);
  const handledForcedAuth = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const requestSerialRef = useRef(0);
  const loadMoreInFlightRef = useRef(false);

  const canUnlockFullFeed = session?.user?.role === "reader" || session?.user?.role === "admin";
  const visibleArticles = canUnlockFullFeed ? items : items.slice(0, previewCount);

  const activeFilterSummary = useMemo(() => {
    const values = [];
    if (query.trim()) values.push(`query "${query.trim()}"`);
    if (selectedSource !== "all") values.push(selectedSource);
    if (selectedTopic !== "all") values.push(topics.find((topic) => topic.id === selectedTopic)?.label || selectedTopic);
    return values.join(" • ");
  }, [query, selectedSource, selectedTopic, topics]);

  useEffect(() => {
    const authRequired = searchParams.get("auth");
    if (authRequired !== "required" || handledForcedAuth.current) {
      return;
    }

    handledForcedAuth.current = true;
    const nextTarget = searchParams.get("next");
    router.replace("/");
    openReaderAuth({
      mode: "signup",
      onSuccess: nextTarget ? () => router.push(nextTarget) : undefined,
    });
  }, [openReaderAuth, router, searchParams]);

  useEffect(() => {
    const currentRequest = ++requestSerialRef.current;
    const controller = new AbortController();
    const normalizedQuery = normalize(query);

    if (!normalizedQuery && selectedSource === "all" && selectedTopic === "all" && sort === "newest") {
      Promise.resolve().then(() => {
        if (requestSerialRef.current !== currentRequest) return;
        startTransition(() => {
          setItems(initialItems);
          setFilteredTotal(initialTotal);
          setHasMore(initialItems.length < initialTotal);
        });
      });
      return () => controller.abort();
    }

    Promise.resolve().then(() => {
      if (requestSerialRef.current === currentRequest) {
        setLoading(true);
      }
    });

    const params = new URLSearchParams({
      offset: "0",
      limit: String(apiPageSize),
      sort,
    });

    if (normalizedQuery) params.set("q", normalizedQuery);
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedTopic !== "all") params.set("topic", selectedTopic);

    fetch(`/api/news?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load the feed.");
        }
        return (await response.json()) as NewsApiPayload;
      })
      .then((payload) => {
        if (requestSerialRef.current !== currentRequest) return;
        startTransition(() => {
          setItems(payload.items);
          setFilteredTotal(payload.total);
          setHasMore(payload.items.length < payload.total);
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
      })
      .finally(() => {
        if (requestSerialRef.current === currentRequest) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [initialItems, initialTotal, query, selectedSource, selectedTopic, sort]);

  useEffect(() => {
    if (!canUnlockFullFeed || !hasMore || !loadMoreRef.current || loading || loadMoreInFlightRef.current) {
      return;
    }

    const target = loadMoreRef.current;
    const loadMore = () => {
      if (loadMoreInFlightRef.current) {
        return;
      }

      loadMoreInFlightRef.current = true;
      setLoadingMore(true);

      const params = new URLSearchParams({
        offset: String(items.length),
        limit: String(Math.max(viewMoreIncrement, apiPageSize)),
        sort,
      });

      const normalizedQuery = normalize(query);
      if (normalizedQuery) params.set("q", normalizedQuery);
      if (selectedSource !== "all") params.set("source", selectedSource);
      if (selectedTopic !== "all") params.set("topic", selectedTopic);

      fetch(`/api/news?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Unable to load more articles.");
          }
          return (await response.json()) as NewsApiPayload;
        })
        .then((payload) => {
          startTransition(() => {
            let nextLength = items.length;
            setItems((current) => {
              const deduped = new Map(current.map((item) => [item.id, item]));
              for (const item of payload.items) {
                deduped.set(item.id, item);
              }
              const nextItems = [...deduped.values()];
              nextLength = nextItems.length;
              return nextItems;
            });
            setFilteredTotal(payload.total);
            setHasMore(nextLength < payload.total);
          });
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          loadMoreInFlightRef.current = false;
          setLoadingMore(false);
        });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        observer.disconnect();
        loadMore();
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(target);

    const onScroll = () => {
      if (loadMoreInFlightRef.current || !hasMore || loading) {
        return;
      }

      const rect = target.getBoundingClientRect();
      if (rect.top - window.innerHeight < 280) {
        observer.takeRecords();
        observer.disconnect();
        loadMore();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [canUnlockFullFeed, hasMore, items, loading, query, selectedSource, selectedTopic, sort, viewMoreIncrement]);

  const unlockAndContinue = (action: () => void, mode: "signin" | "signup" = "signup") => {
    openReaderAuth({
      mode,
      onSuccess: action,
    });
  };

  return (
    <section className="space-y-8">
      <div className="feed-panel glass-orbit grid gap-4 rounded-3xl border p-4 backdrop-blur md:grid-cols-[1.2fr_0.7fr_0.7fr_0.6fr]">
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Search
          <input
            className="feed-input rounded-xl border border-white/10 px-4 py-3 text-sm outline-none ring-fuchsia-400 transition focus:ring-2"
            placeholder="Search headlines, excerpts, reporters, companies..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Source
          <select
            className="feed-input rounded-xl border border-white/10 px-4 py-3 text-sm outline-none ring-fuchsia-400 transition focus:ring-2"
            value={selectedSource}
            onChange={(event) => setSelectedSource(event.target.value)}
          >
            <option value="all">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Subject
          <select
            className="feed-input rounded-xl border border-white/10 px-4 py-3 text-sm outline-none ring-fuchsia-400 transition focus:ring-2"
            value={selectedTopic}
            onChange={(event) => setSelectedTopic(event.target.value)}
          >
            <option value="all">All subjects</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Sort
          <select
            className="feed-input rounded-xl border border-white/10 px-4 py-3 text-sm outline-none ring-fuchsia-400 transition focus:ring-2"
            value={sort}
            onChange={(event) => setSort(event.target.value as "newest" | "oldest" | "title")}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A-Z</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <div>
          <p>
            Showing {visibleArticles.length} of {filteredTotal} matching articles
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
            {activeFilterSummary ? `${activeFilterSummary} • ` : ""}
            {totalArticlesInDb} total articles in the database
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {topics.slice(0, 6).map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => setSelectedTopic((current) => (current === topic.id ? "all" : topic.id))}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                selectedTopic === topic.id
                  ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100"
              }`}
            >
              {topic.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="feed-panel rounded-3xl border p-10 text-center text-sm text-slate-200">Refreshing the live feed...</div>
      ) : null}

      {filteredTotal === 0 && !loading ? (
        <div className="rounded-3xl border border-dashed border-fuchsia-300/30 bg-slate-950/50 p-10 text-center text-slate-300">
          No articles match those filters yet.
        </div>
      ) : (
        <>
          {!isAuthenticated ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-100">
              <div>
                <p className="font-semibold uppercase tracking-[0.16em] text-cyan-200">Free preview active</p>
                <p className="mt-1 text-cyan-50">Explore the first five articles, then unlock the full live feed with a free email signup.</p>
              </div>
              <button
                type="button"
                onClick={() => openReaderAuth({ mode: "signup" })}
                className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-900"
              >
                Create account
              </button>
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleArticles.map((article, index) => (
              <ArticleCard
                key={`${article.id}-${article.url}`}
                article={article}
                index={index}
                locked={!canUnlockFullFeed}
                onOpenArticle={() => {
                  if (!canUnlockFullFeed) {
                    unlockAndContinue(() => {
                      router.push(`/articles/${article.id}`);
                    });
                    return;
                  }

                  router.push(`/articles/${article.id}`);
                }}
                onLockedArticleClick={() =>
                  unlockAndContinue(() => {
                    router.push(`/articles/${article.id}`);
                  })
                }
                onLockedSourceClick={() =>
                  unlockAndContinue(() => {
                    window.open(article.url, "_blank", "noopener,noreferrer");
                  })
                }
              />
            ))}
          </div>

          {canUnlockFullFeed && hasMore ? (
            <div ref={loadMoreRef} className="feed-panel rounded-3xl border p-5 text-center text-sm text-slate-200">
              <div className="newsrunner-loader mx-auto flex max-w-xl items-center justify-center gap-4">
                <div className="newsrunner-scene" aria-hidden>
                  <div className="newsrunner-rider">
                    <span className="newsrunner-head" />
                    <span className="newsrunner-body" />
                    <span className="newsrunner-wheel newsrunner-wheel-left" />
                    <span className="newsrunner-wheel newsrunner-wheel-right" />
                  </div>
                  <span className="newsrunner-paper newsrunner-paper-one" />
                  <span className="newsrunner-paper newsrunner-paper-two" />
                  <span className="newsrunner-paper newsrunner-paper-three" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">
                    {loadingMore ? "Pulling in more reporting..." : "Keep scrolling, the next wave of articles is queued."}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                    Live feed pagination from the article database
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {!canUnlockFullFeed && filteredTotal > visibleArticles.length ? (
            <div className="feed-panel glass-orbit rounded-3xl border p-6 text-center text-slate-100">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Full feed locked</p>
              <h3 className="mt-3 text-2xl font-black text-white">The full archive scrolls infinitely once you unlock it.</h3>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                Free members get article pages, deeper discovery filters, and the full rolling database instead of the five-card preview.
              </p>
              <button
                type="button"
                onClick={() => openReaderAuth({ mode: "signup" })}
                className="mt-5 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(8,145,178,0.28)]"
              >
                Unlock full feed
              </button>
            </div>
          ) : null}

          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-slate-300">
            Headlines and short source-grounded excerpts are shown for discovery. Open the original publisher for the complete
            article, full context, and full copyright attribution.
          </div>
        </>
      )}
    </section>
  );
}
