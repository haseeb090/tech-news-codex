import { describe, expect, it } from "vitest";

import { longestSharedWordRun, validateRewrittenArticle } from "@/lib/ingestion/rewrite-validation";

describe("rewrite-validation", () => {
  it("rejects rewritten copy that still shares long source phrases", () => {
    const result = validateRewrittenArticle(
      {
        title: "Google closes its 32 billion acquisition of cybersecurity company Wiz",
        body:
          "Google closed its 32 billion acquisition of cybersecurity company Wiz this week. The article explains what the deal means for venture investors and startup exits. It also covers reaction from analysts and the broader cloud-security market. The report further explains why this became Google's biggest acquisition to date.",
        writer: null,
        publishedAt: null,
      },
      {
        extracted: {
          title: "Google closes its $32 billion acquisition of cybersecurity company Wiz",
          body:
            "Google closed its 32 billion acquisition of cybersecurity company Wiz this week. The article explains what the deal means for venture investors and startup exits. It also covers reaction from analysts and the broader cloud-security market. The report further explains why this became Google's biggest acquisition to date.",
          writer: null,
          publishedAt: null,
        },
        sourceText:
          "Google closed its 32 billion acquisition of cybersecurity company Wiz this week. The article explains what the deal means for venture investors and startup exits. It also covers reaction from analysts and the broader cloud-security market. The report further explains why this became Google's biggest acquisition to date.",
      },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/source wording|source phrases/i);
  });

  it("accepts grounded rewrites that paraphrase the source", () => {
    const result = validateRewrittenArticle(
      {
        title: "Google's Wiz purchase becomes its largest cloud-security bet yet",
        body:
          "Google has finalized a $32 billion deal for Wiz, turning the cloud-security company into the centerpiece of a much larger defensive push. The report says investors are watching the transaction as a signal that major platform vendors will keep paying heavily for security startups with strong enterprise adoption. Analysts also frame the acquisition as a test of how aggressively Google wants to compete for security workloads inside large cloud accounts. The article adds that the size of the transaction makes it the biggest takeover in Google's history.",
        writer: null,
        publishedAt: null,
      },
      {
        extracted: {
          title: "Google closes its $32 billion acquisition of cybersecurity company Wiz",
          body:
            "Google closed its 32 billion acquisition of cybersecurity company Wiz this week. The article explains what the deal means for venture investors and startup exits. It also covers reaction from analysts and the broader cloud-security market. The report further explains why this became Google's biggest acquisition to date.",
          writer: null,
          publishedAt: null,
          context: "Investors and analysts are treating the transaction as a major signal for cloud-security consolidation.",
        },
        sourceText:
          "Google closed its 32 billion acquisition of cybersecurity company Wiz this week. The article explains what the deal means for venture investors and startup exits. It also covers reaction from analysts and the broader cloud-security market. The report further explains why this became Google's biggest acquisition to date.",
      },
    );

    expect(result.ok).toBe(true);
  });

  it("measures shared word runs conservatively", () => {
    expect(longestSharedWordRun("alpha beta gamma delta epsilon", "zero alpha beta gamma delta nine", 8)).toBe(4);
  });

  it("rejects unsupported numeric details introduced by the rewrite", () => {
    const result = validateRewrittenArticle(
      {
        title: "Ancient Martian river delta found beneath Jezero crater",
        body:
          "Radar sweeps spanning 40 kilometers allegedly exposed a delta hidden under Jezero crater. The buried layers suggest water once built up deposits beneath the basin floor. Researchers say the structure gives Perseverance another clue about ancient habitability and long-running surface flows. The study reframes the crater as a place where sediment collected over time rather than a landscape shaped only by brief flooding.",
        writer: null,
        publishedAt: null,
      },
      {
        extracted: {
          title: "Perseverance's radar revealed an ancient subsurface river delta on Mars",
          body:
            "Researchers analyzing 6.1 kilometers of RIMFAX radar data found a buried river delta beneath Jezero crater. The structure strengthens evidence that water once flowed through the region and left sedimentary deposits below the surface. The results add context for Perseverance's search for signs of ancient habitability. Scientists say the discovery helps explain Mars' watery past.",
          writer: null,
          publishedAt: null,
        },
        sourceText:
          "Researchers analyzing 6.1 kilometers of RIMFAX radar data found a buried river delta beneath Jezero crater. The structure strengthens evidence that water once flowed through the region and left sedimentary deposits below the surface. The results add context for Perseverance's search for signs of ancient habitability. Scientists say the discovery helps explain Mars' watery past.",
      },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/numeric details/i);
  });

  it("rejects unsupported uncertainty claims introduced by the rewrite", () => {
    const result = validateRewrittenArticle(
      {
        title: "Publisher withdraws horror novel after AI-use allegations",
        body:
          "Hachette halted publication after accusations that software wrote much of the novel. The person behind the book, whose identity remains undisclosed, denied relying on AI and suggested a collaborator may have shaped the draft. Reviewers and detection tools pointed to melodramatic repetition and narrative gaps as warning signs. The dispute is now testing how publishers respond when machine authorship is suspected.",
        writer: null,
        publishedAt: null,
      },
      {
        extracted: {
          title: "Hachette pulls Shy Girl horror novel after concerns about AI use",
          body:
            "Hachette canceled the novel's release after allegations that large portions were generated with AI. Ballard denied using AI and said a collaborator may have contributed to the manuscript. Reporting and detection tools cited repetitive structure and logical gaps as signs of AI use. The dispute has become a high-profile test for how publishers handle suspected AI authorship.",
          writer: null,
          publishedAt: null,
        },
        sourceText:
          "Hachette canceled the novel's release after allegations that large portions were generated with AI. Ballard denied using AI and said a collaborator may have contributed to the manuscript. Reporting and detection tools cited repetitive structure and logical gaps as signs of AI use. The dispute has become a high-profile test for how publishers handle suspected AI authorship.",
      },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/uncertainty/i);
  });

  it("rejects unsupported broad time windows introduced by the rewrite", () => {
    const result = validateRewrittenArticle(
      {
        title: "AI startups dominate venture funding with strong recent returns",
        body:
          "AI companies captured a record share of venture funding last year. A small group of firms accounted for a large share of the money flowing into the market. Their combined fundraising surpassed $189 billion in the past year, reshaping how investors deploy capital. Analysts say the concentration reflects the high cost of building and running large AI systems.",
        writer: null,
        publishedAt: null,
      },
      {
        extracted: {
          title: "AI startups are eating the venture industry and the returns, so far, are good",
          body:
            "AI startups accounted for 41% of the $128 billion in venture dollars raised by companies on Carta last year. OpenAI and Anthropic accounted for a heavy chunk of the $189 billion in global venture capital raised last month. Investors say the market has become bifurcated, with money clustering around a small number of firms. The concentration is tied to the high cost of training and running AI models.",
          writer: null,
          publishedAt: null,
        },
        sourceText:
          "AI startups accounted for 41% of the $128 billion in venture dollars raised by companies on Carta last year. OpenAI and Anthropic accounted for a heavy chunk of the $189 billion in global venture capital raised last month. Investors say the market has become bifurcated, with money clustering around a small number of firms. The concentration is tied to the high cost of training and running AI models.",
      },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/time-window/i);
  });
});
