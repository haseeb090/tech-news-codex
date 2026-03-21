const consumerCommerceDomains = new Set([
  "www.zdnet.com",
  "www.theverge.com",
  "www.engadget.com",
  "www.wired.com",
]);

const evergreenTitlePatterns = [
  /^how to\b/i,
  /^best\b/i,
  /^review\b/i,
  /^top \d+\b/i,
  /\bguide\b/i,
  /\bcomparison\b/i,
  /\bvs\.?\b/i,
  /\b\d+\s+(ways|methods|picks)\b/i,
];

const evergreenUrlPatterns = [
  /\/how-to-/i,
  /\/best-/i,
  /-review(?:[-/]|$)/i,
  /-vs-(?:[-/]|$)/i,
  /comparison/i,
  /\/guide(?:[-/]|$)/i,
];

const commerceTitlePatterns = [/\bdeals?\b/i, /\bsale\b/i, /\bdiscount\b/i, /\bcoupon\b/i];
const commerceUrlPatterns = [/deal/i, /sale/i, /discount/i, /coupon/i, /spring-sale/i];
const nonArticleMediaUrlPatterns = [/\/video(?:[/-]|$)/i, /\/podcast(?:[/-]|$)/i, /\/audio(?:[/-]|$)/i];

export const getNonNewsReason = (params: {
  url: string;
  sourceDomain: string;
  title?: string | null;
}): string | null => {
  const normalizedTitle = (params.title || "").trim();

  if (nonArticleMediaUrlPatterns.some((pattern) => pattern.test(params.url))) {
    return "non-article-media";
  }

  if (
    evergreenTitlePatterns.some((pattern) => pattern.test(normalizedTitle)) ||
    evergreenUrlPatterns.some((pattern) => pattern.test(params.url))
  ) {
    return "evergreen-guide-review";
  }

  if (
    consumerCommerceDomains.has(params.sourceDomain) &&
    (commerceTitlePatterns.some((pattern) => pattern.test(normalizedTitle)) ||
      commerceUrlPatterns.some((pattern) => pattern.test(params.url)))
  ) {
    return "consumer-commerce-roundup";
  }

  return null;
};
