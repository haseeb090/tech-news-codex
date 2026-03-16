import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { appConfig } from "@/lib/config";
import { classifyFailure, type FailureClassification } from "@/lib/ingestion/failure-classification";
import { deterministicExtract, fetchHtml, sourceTextForValidation } from "@/lib/ingestion/deterministic-extract";
import { llmExtractArticle } from "@/lib/ingestion/llm-extract";
import { getSourcePolicy, type SourceProcessingPolicy } from "@/lib/ingestion/source-policy";
import { validateExtractionAgainstSource } from "@/lib/ingestion/validation";
import { assertSafeRemoteUrl } from "@/lib/ssrf";
import type { ExtractedArticle } from "@/lib/types";
import { getSourceDomain } from "@/lib/url-utils";

const ArticleState = Annotation.Root({
  url: Annotation<string>,
  sourceDomain: Annotation<string>,
  sourcePolicy: Annotation<SourceProcessingPolicy | null>,
  html: Annotation<string>,
  sourceText: Annotation<string>,
  diagnostics: Annotation<string[]>,
  extracted: Annotation<ExtractedArticle | null>,
  needsLlm: Annotation<boolean>,
  usedModel: Annotation<string | null>,
  validationReason: Annotation<string | null>,
  failureClassification: Annotation<FailureClassification | null>,
  error: Annotation<string | null>,
});

const appendDiagnostics = (current: string[], ...next: Array<string | null | undefined>): string[] => [
  ...current,
  ...next.filter((value): value is string => Boolean(value)),
];

const fetchNode = async (state: typeof ArticleState.State) => {
  await assertSafeRemoteUrl(state.url);
  const sourcePolicy = getSourcePolicy(state.url);
  const html = await fetchHtml(state.url, sourcePolicy.fetchTimeoutMs);

  return {
    sourceDomain: getSourceDomain(state.url),
    sourcePolicy,
    html,
  };
};

const diagnoseNode = async (state: typeof ArticleState.State) => {
  const sourceText = sourceTextForValidation(state.html, state.url);
  const diagnostics = appendDiagnostics(
    state.diagnostics,
    sourceText.length < 240 ? "thin-source-text" : null,
    state.sourcePolicy?.skipLlmWhenBodyMissing && sourceText.length < 240 ? "skip-llm-when-body-missing" : null,
  );

  return {
    sourceText,
    diagnostics,
  };
};

const deterministicNode = async (state: typeof ArticleState.State) => {
  const extracted = deterministicExtract(state.html, state.url);
  const diagnostics = appendDiagnostics(
    state.diagnostics,
    extracted.body.length < 240 ? "deterministic-body-too-short" : null,
  );

  return {
    extracted,
    diagnostics,
  };
};

const decideFallbackNode = async (state: typeof ArticleState.State) => {
  if (!state.extracted) {
    return {
      needsLlm: false,
      validationReason: "No extracted article available",
      error: "No extracted article available",
      diagnostics: appendDiagnostics(state.diagnostics, "deterministic-empty"),
    };
  }

  const sourcePolicy = state.sourcePolicy ?? getSourcePolicy(state.url);
  const validation = validateExtractionAgainstSource(state.extracted, state.sourceText);
  const shouldSkipLlmFallback =
    sourcePolicy.skipLlmWhenBodyMissing && state.extracted.body.length < 240 && state.sourceText.length < 240;
  const validationReason = validation.reason || "Deterministic extraction quality gate failed";

  return {
    needsLlm: !validation.ok && !shouldSkipLlmFallback,
    validationReason: validation.ok ? null : validationReason,
    error: validation.ok ? null : shouldSkipLlmFallback ? validationReason : null,
    diagnostics: appendDiagnostics(
      state.diagnostics,
      validation.ok ? "deterministic-validated" : `deterministic-failed:${validationReason}`,
      shouldSkipLlmFallback ? "llm-skipped-by-policy" : null,
    ),
  };
};

const llmFallbackNode = async (state: typeof ArticleState.State) => {
  if (!state.sourcePolicy) {
    return {
      needsLlm: false,
      error: state.error || "Missing source policy",
      diagnostics: appendDiagnostics(state.diagnostics, "missing-source-policy"),
    };
  }

  if (!state.needsLlm) {
    return {
      needsLlm: false,
    };
  }

  const fallbackTitle = state.extracted?.title || "";
  const extracted = await llmExtractArticle({
    url: state.url,
    html: state.html,
    sourceText: state.sourceText,
    fallbackTitle,
    processingTimeoutMs: state.sourcePolicy.processingTimeoutMs,
    htmlMaxChars: state.sourcePolicy.llmHtmlMaxChars,
  });

  return {
    extracted,
    needsLlm: false,
    usedModel: appConfig.ollamaModel,
    error: null,
    diagnostics: appendDiagnostics(state.diagnostics, "llm-fallback-used"),
  };
};

const validateNode = async (state: typeof ArticleState.State) => {
  if (!state.extracted) {
    return {
      validationReason: "No extracted article available",
      error: "No extracted article available",
      diagnostics: appendDiagnostics(state.diagnostics, "final-empty"),
    };
  }

  const validation = validateExtractionAgainstSource(state.extracted, state.sourceText);
  if (!validation.ok) {
    return {
      validationReason: validation.reason || "Final validation failed",
      error: validation.reason || "Final validation failed",
      diagnostics: appendDiagnostics(
        state.diagnostics,
        `final-validation-failed:${validation.reason || "Final validation failed"}`,
      ),
    };
  }

  return {
    validationReason: null,
    error: null,
    diagnostics: appendDiagnostics(state.diagnostics, "final-validation-passed"),
  };
};

const classifyFailureNode = async (state: typeof ArticleState.State) => {
  if (!state.error) {
    return {
      failureClassification: null,
    };
  }

  const failureClassification = classifyFailure(state.error);

  return {
    failureClassification,
    diagnostics: appendDiagnostics(state.diagnostics, `failure-classified:${failureClassification}`),
  };
};

const routeAfterDecision = (state: typeof ArticleState.State): string => {
  if (state.error) return "classifyFailure";
  if (state.needsLlm) return "llmFallback";
  return "validate";
};

const routeAfterValidation = (state: typeof ArticleState.State): string => {
  if (state.error) return "classifyFailure";
  return END;
};

const articleGraph = new StateGraph(ArticleState)
  .addNode("fetch", fetchNode)
  .addNode("diagnose", diagnoseNode)
  .addNode("deterministic", deterministicNode)
  .addNode("decideFallback", decideFallbackNode)
  .addNode("llmFallback", llmFallbackNode)
  .addNode("validate", validateNode)
  .addNode("classifyFailure", classifyFailureNode)
  .addEdge(START, "fetch")
  .addEdge("fetch", "diagnose")
  .addEdge("diagnose", "deterministic")
  .addEdge("deterministic", "decideFallback")
  .addConditionalEdges("decideFallback", routeAfterDecision)
  .addEdge("llmFallback", "validate")
  .addConditionalEdges("validate", routeAfterValidation)
  .addEdge("classifyFailure", END)
  .compile();

export const runArticleExtractionGraph = async (
  url: string,
): Promise<{ extracted: ExtractedArticle; modelUsed: string | null }> => {
  const sourcePolicy = getSourcePolicy(url);
  const timeoutMessage = `Article processing timed out after ${sourcePolicy.processingTimeoutMs}ms`;
  const result = await new Promise<Awaited<ReturnType<typeof articleGraph.invoke>>>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, sourcePolicy.processingTimeoutMs);

    void articleGraph
      .invoke({
        url,
        sourceDomain: getSourceDomain(url),
        sourcePolicy,
        html: "",
        sourceText: "",
        diagnostics: [],
        extracted: null,
        needsLlm: false,
        usedModel: null,
        validationReason: null,
        failureClassification: null,
        error: null,
      })
      .then(
        (value) => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      );
  });

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.extracted) {
    throw new Error("Extraction graph returned empty result");
  }

  return {
    extracted: result.extracted,
    modelUsed: result.usedModel,
  };
};
