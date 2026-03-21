import { describe, expect, it } from "vitest";

import { getNonNewsReason } from "@/lib/ingestion/newsworthiness";

describe("newsworthiness filter", () => {
  it("filters obvious evergreen guides and reviews", () => {
    expect(
      getNonNewsReason({
        url: "https://www.zdnet.com/article/how-to-stop-the-internet-from-tracking-you",
        sourceDomain: "www.zdnet.com",
        title: "How to stop the internet from tracking you",
      }),
    ).toBe("evergreen-guide-review");

    expect(
      getNonNewsReason({
        url: "https://www.engadget.com/mobile/smartphones/nothing-phone-4a-pro-review-glyph-matrix-130042005.html",
        sourceDomain: "www.engadget.com",
        title: "Nothing Phone 4A Pro review",
      }),
    ).toBe("evergreen-guide-review");
  });

  it("filters consumer-commerce roundups on news-adjacent sites", () => {
    expect(
      getNonNewsReason({
        url: "https://www.zdnet.com/article/best-early-amazon-big-spring-sale-2026-tv-deals",
        sourceDomain: "www.zdnet.com",
        title: "Best early Amazon Big Spring Sale 2026 TV deals",
      }),
    ).not.toBeNull();
  });

  it("filters non-article media pages", () => {
    expect(
      getNonNewsReason({
        url: "https://techcrunch.com/video/what-happened-at-nvidia-gtc-nemoclaw-robot-olaf-and-a-1-trillion-bet",
        sourceDomain: "techcrunch.com",
        title: "What happened at Nvidia GTC?",
      }),
    ).toBe("non-article-media");
  });

  it("keeps straight news coverage", () => {
    expect(
      getNonNewsReason({
        url: "https://www.zdnet.com/article/state-ai-safety-laws-california-new-york",
        sourceDomain: "www.zdnet.com",
        title: "Federal AI guidance outlines plan to preempt state laws",
      }),
    ).toBeNull();
  });
});
