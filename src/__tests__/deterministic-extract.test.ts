import { describe, expect, it } from "vitest";

import { deterministicExtract, sourceTextForValidation } from "@/lib/ingestion/deterministic-extract";

describe("deterministicExtract", () => {
  it("strips affiliate, promo, and sidebar noise from article bodies", () => {
    const html = `
      <html>
        <head>
          <title>Chip startup lands new funding round | TechCrunch</title>
          <meta property="og:title" content="Chip startup lands new funding round" />
          <meta name="author" content="Taylor Kim" />
        </head>
        <body>
          <article>
            <p>Chip startup lands new funding round.</p>
            <p>A hardware startup focused on inference chips has closed a new funding round led by enterprise investors.</p>
            <p>The company says it will use the capital to expand manufacturing partnerships and hire more systems engineers.</p>
            <p>Executives also outlined plans to ship a second-generation accelerator aimed at data-center deployments later this year.</p>
            <p>If you buy something through a link in this article, we may earn commission.</p>
            <p>Register now to save up to $400 at our flagship event.</p>
          </article>
          <aside>Most Popular</aside>
        </body>
      </html>
    `;

    const extracted = deterministicExtract(html, "https://techcrunch.com/2026/03/20/chip-startup-lands-new-funding-round");

    expect(extracted.title).toBe("Chip startup lands new funding round");
    expect(extracted.writer).toBe("Taylor Kim");
    expect(extracted.body).toContain("hardware startup focused on inference chips");
    expect(extracted.body).not.toMatch(/earn commission/i);
    expect(extracted.body).not.toMatch(/register now/i);
    expect(extracted.body).not.toMatch(/most popular/i);
  });

  it("includes cleaned title and context in the validation source text", () => {
    const html = `
      <html>
        <head>
          <title>Chip startup lands new funding round | TechCrunch</title>
          <meta property="og:title" content="Chip startup lands new funding round" />
          <meta name="description" content="Enterprise chipmaker expands manufacturing after landing new financing." />
        </head>
        <body>
          <article>
            <p>A hardware startup focused on inference chips has closed a new funding round led by enterprise investors.</p>
            <p>The company says it will use the capital to expand manufacturing partnerships and hire more systems engineers.</p>
            <p>Executives also outlined plans to ship a second-generation accelerator aimed at data-center deployments later this year.</p>
            <p>The latest investment gives the startup more room to scale supply and customer support.</p>
          </article>
        </body>
      </html>
    `;

    const sourceText = sourceTextForValidation(
      html,
      "https://techcrunch.com/2026/03/20/chip-startup-lands-new-funding-round",
    );

    expect(sourceText).toContain("Chip startup lands new funding round");
    expect(sourceText).toContain("Enterprise chipmaker expands manufacturing after landing new financing.");
    expect(sourceText).toContain("A hardware startup focused on inference chips has closed a new funding round");
  });

  it("removes Verge commerce disclosures and repairs double-encoded mojibake", () => {
    const html = `
      <html>
        <head>
          <title>Accessory deal drops to a new low | The Verge</title>
          <meta property="og:title" content="Accessory deal drops to a new low | The Verge" />
        </head>
        <body>
          <article>
            <p>Accessory makerÃ¢â‚¬â„¢s latest charger now ships with a redesigned cable and updated power profile.</p>
            <p>The accessory is now available at several retailers after a fresh restock this week.</p>
            <p>If you buy something from a Verge link, Vox Media may earn a commission.</p>
            <p>Prices were accurate at the time of publishing but may change.</p>
            <p>The updated model supports faster charging across tablets and ultraportable laptops.</p>
          </article>
        </body>
      </html>
    `;

    const extracted = deterministicExtract(html, "https://www.theverge.com/2026/03/21/accessory-deal");

    expect(extracted.body).toContain("Accessory maker's latest charger now ships with a redesigned cable");
    expect(extracted.body).not.toMatch(/vox media may earn|prices were accurate/i);
    expect(extracted.body).not.toMatch(/Ã¢â‚¬|â€™/i);
  });
});
