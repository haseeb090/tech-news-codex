export type FailureClassification = "transient" | "terminal";

const TERMINAL_ERROR_PATTERNS = [
  /title too short/i,
  /body too short/i,
  /body is not article-like enough/i,
  /body still contains site boilerplate/i,
  /title not supported by source text/i,
  /body content not grounded in source text/i,
  /writer name not supported by source text/i,
  /unsupported content type/i,
  /http 401/i,
  /http 403/i,
  /http 404/i,
  /no extracted article available/i,
  /anti-bot challenge/i,
  /cloudflare challenge/i,
];

const TRANSIENT_ERROR_PATTERNS = [
  /timed out/i,
  /timeout/i,
  /terminated/i,
  /fetch failed/i,
  /network/i,
  /socket/i,
  /econnreset/i,
  /econnrefused/i,
  /503/i,
  /502/i,
  /504/i,
  /429/i,
  /too many requests/i,
];

export const classifyFailure = (message: string): FailureClassification => {
  if (TERMINAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return "terminal";
  }

  if (TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return "transient";
  }

  return "transient";
};
