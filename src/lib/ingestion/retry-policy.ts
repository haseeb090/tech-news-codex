import { classifyFailure } from "@/lib/ingestion/failure-classification";
import { getSourcePolicy } from "@/lib/ingestion/source-policy";

export interface RetryPlan {
  shouldRetry: boolean;
  retryCount: number;
  nextRetryAt: Date | null;
  classification: "transient" | "terminal";
}

export const buildRetryPlan = (params: {
  currentRetryCount: number;
  errorMessage: string;
  urlOrDomain: string;
}): RetryPlan => {
  const policy = getSourcePolicy(params.urlOrDomain);
  const classification = classifyFailure(params.errorMessage);

  if (classification === "terminal") {
    return {
      shouldRetry: false,
      retryCount: policy.maxRetries,
      nextRetryAt: null,
      classification,
    };
  }

  const retryCount = params.currentRetryCount + 1;
  const shouldRetry = retryCount < policy.maxRetries;

  if (!shouldRetry) {
    return {
      shouldRetry,
      retryCount,
      nextRetryAt: null,
      classification,
    };
  }

  const cooldownMultiplier = 2 ** Math.max(0, retryCount - 1);
  const cooldownMinutes = policy.retryCooldownMinutes * cooldownMultiplier;

  return {
    shouldRetry,
    retryCount,
    nextRetryAt: new Date(Date.now() + cooldownMinutes * 60 * 1000),
    classification,
  };
};
