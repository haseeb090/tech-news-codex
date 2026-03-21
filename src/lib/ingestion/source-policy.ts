import { appConfig } from "@/lib/config";
import { getSourceDomain } from "@/lib/url-utils";

export interface SourceProcessingPolicy {
  sourceDomain: string;
  fetchTimeoutMs: number;
  processingTimeoutMs: number;
  llmHtmlMaxChars: number;
  retryCooldownMinutes: number;
  maxRetries: number;
  skipLlmWhenBodyMissing: boolean;
}

interface SourcePolicyOverride extends Partial<Omit<SourceProcessingPolicy, "sourceDomain">> {
  domains: string[];
}

const SOURCE_POLICY_OVERRIDES: SourcePolicyOverride[] = [
  {
    domains: ["www.bleepingcomputer.com"],
    fetchTimeoutMs: 30_000,
    processingTimeoutMs: 90_000,
    llmHtmlMaxChars: 26_000,
    retryCooldownMinutes: 45,
    maxRetries: 4,
  },
  {
    domains: ["go.theregister.com", "www.theregister.com"],
    fetchTimeoutMs: 25_000,
    processingTimeoutMs: 75_000,
    llmHtmlMaxChars: 28_000,
    retryCooldownMinutes: 40,
    maxRetries: 4,
  },
  {
    domains: ["techcrunch.com", "www.techcrunch.com"],
    processingTimeoutMs: 75_000,
    llmHtmlMaxChars: 22_000,
  },
  {
    domains: ["www.engadget.com"],
    fetchTimeoutMs: 25_000,
    processingTimeoutMs: 80_000,
    llmHtmlMaxChars: 20_000,
    skipLlmWhenBodyMissing: true,
  },
  {
    domains: ["www.technologyreview.com", "www.theverge.com", "www.wired.com"],
    llmHtmlMaxChars: 30_000,
  },
  {
    domains: ["www.theverge.com"],
    processingTimeoutMs: 95_000,
    llmHtmlMaxChars: 24_000,
  },
];

const DEFAULT_POLICY = (sourceDomain: string): SourceProcessingPolicy => ({
  sourceDomain,
  fetchTimeoutMs: appConfig.articleFetchTimeoutMs,
  processingTimeoutMs: appConfig.articleProcessTimeoutMs,
  llmHtmlMaxChars: appConfig.llmHtmlMaxChars,
  retryCooldownMinutes: appConfig.retryCooldownMinutes,
  maxRetries: appConfig.maxRetries,
  skipLlmWhenBodyMissing: false,
});

export const getSourcePolicy = (urlOrDomain: string): SourceProcessingPolicy => {
  const sourceDomain = urlOrDomain.includes("://") ? getSourceDomain(urlOrDomain) : urlOrDomain.toLowerCase();
  const override = SOURCE_POLICY_OVERRIDES.reduce<Partial<SourceProcessingPolicy>>((merged, candidate) => {
    if (!candidate.domains.includes(sourceDomain)) {
      return merged;
    }

    const policyOverride = { ...candidate } as Partial<SourceProcessingPolicy> & { domains?: string[] };
    delete policyOverride.domains;
    return {
      ...merged,
      ...policyOverride,
    };
  }, {});

  return {
    ...DEFAULT_POLICY(sourceDomain),
    ...override,
    sourceDomain,
  };
};
