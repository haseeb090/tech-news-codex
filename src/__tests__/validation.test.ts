import { describe, expect, it } from "vitest";

import { validateExtractionAgainstSource } from "@/lib/ingestion/validation";

const sourceText = `OpenAI announced a new model for software engineering teams.
The release introduces improved code reasoning and faster tool calls.
The article is written by Jordan Lee and includes benchmark evidence and rollout details.`;

describe("validateExtractionAgainstSource", () => {
  it("accepts grounded extraction", () => {
    const result = validateExtractionAgainstSource(
      {
        title: "OpenAI announced a new model for software engineering teams",
        body: `${sourceText} The release introduces improved code reasoning and faster tool calls in benchmark tests.`,
        writer: "Jordan Lee",
        publishedAt: null,
      },
      sourceText,
    );

    expect(result.ok).toBe(true);
  });

  it("rejects unsupported writer", () => {
    const result = validateExtractionAgainstSource(
      {
        title: "OpenAI announced a new model for software engineering teams",
        body: `${sourceText} The release introduces improved code reasoning and faster tool calls in benchmark tests.`,
        writer: "Invented Person",
        publishedAt: null,
      },
      sourceText,
    );

    expect(result.ok).toBe(false);
  });
});