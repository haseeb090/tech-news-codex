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

  it("accepts titles with strong token overlap even when the exact headline string differs", () => {
    const result = validateExtractionAgainstSource(
      {
        title: "Wiz investor unpacks Google's 32B acquisition",
        body:
          "Google closed its 32 billion acquisition of cybersecurity company Wiz this week. The article explains what the deal means for venture investors and startup exits. It also covers reaction from analysts and the broader cloud-security market. The report further explains why this became Google's biggest acquisition to date.",
        writer: null,
        publishedAt: null,
      },
      "Google closed its 32 billion acquisition of cybersecurity company Wiz this week. The article explains what the deal means for venture investors and startup exits. It also covers reaction from analysts and the broader cloud-security market. The report further explains why this became Google's biggest acquisition to date.",
    );

    expect(result.ok).toBe(true);
  });

  it("rejects article bodies that still contain obvious site boilerplate", () => {
    const result = validateExtractionAgainstSource(
      {
        title: "OpenAI announced a new model for software engineering teams",
        body:
          "OpenAI announced a new model for software engineering teams. The release introduces improved code reasoning and faster tool calls for enterprise teams. Sign up for our newsletter today. Read our privacy policy before commenting. Jordan Lee explained the rollout details for enterprise users, including benchmarks, rollout timing, and reliability goals for production usage.",
        writer: "Jordan Lee",
        publishedAt: null,
      },
      sourceText,
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/boilerplate/i);
  });
});
