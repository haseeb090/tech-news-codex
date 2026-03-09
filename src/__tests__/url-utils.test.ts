import { describe, expect, it } from "vitest";

import { normalizeUrl } from "@/lib/url-utils";

describe("normalizeUrl", () => {
  it("removes tracking params and hash", () => {
    const input = "https://example.com/path/?utm_source=x&gclid=123&keep=1#section";
    expect(normalizeUrl(input)).toBe("https://example.com/path?keep=1");
  });

  it("removes trailing slash for non-root path", () => {
    expect(normalizeUrl("https://example.com/news/")).toBe("https://example.com/news");
  });
});