import { describe, expect, it } from "vitest";

import { classifyFailure } from "@/lib/ingestion/failure-classification";
import { buildRetryPlan } from "@/lib/ingestion/retry-policy";
import { getSourcePolicy } from "@/lib/ingestion/source-policy";

describe("source policies", () => {
  it("applies slower-source overrides for BleepingComputer", () => {
    const policy = getSourcePolicy(
      "https://www.bleepingcomputer.com/news/artificial-intelligence/openai-says-chatgpt-ads-are-not-rolling-out-globally-for-now",
    );

    expect(policy.sourceDomain).toBe("www.bleepingcomputer.com");
    expect(policy.processingTimeoutMs).toBeGreaterThan(60_000);
    expect(policy.retryCooldownMinutes).toBeGreaterThanOrEqual(45);
    expect(policy.llmHtmlMaxChars).toBeLessThan(45_000);
  });
});

describe("retry policy", () => {
  it("treats timeout failures as transient with exponential backoff", () => {
    const plan = buildRetryPlan({
      currentRetryCount: 0,
      errorMessage: "Article processing timed out after 30000ms",
      urlOrDomain: "https://www.bleepingcomputer.com/story",
    });

    expect(classifyFailure("Article processing timed out after 30000ms")).toBe("transient");
    expect(plan.shouldRetry).toBe(true);
    expect(plan.retryCount).toBe(1);
    expect(plan.nextRetryAt).not.toBeNull();
  });

  it("treats grounding failures as terminal", () => {
    const plan = buildRetryPlan({
      currentRetryCount: 0,
      errorMessage: "Title not supported by source text",
      urlOrDomain: "https://techcrunch.com/story",
    });

    expect(classifyFailure("Title not supported by source text")).toBe("terminal");
    expect(plan.shouldRetry).toBe(false);
    expect(plan.nextRetryAt).toBeNull();
  });

  it("treats anti-bot challenge pages as terminal", () => {
    const plan = buildRetryPlan({
      currentRetryCount: 0,
      errorMessage: "Blocked by anti-bot challenge",
      urlOrDomain: "https://www.bleepingcomputer.com/story",
    });

    expect(classifyFailure("Blocked by anti-bot challenge")).toBe("terminal");
    expect(plan.shouldRetry).toBe(false);
  });
});
