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

export interface ArticleGraphEvent {
  level?: "info" | "warn" | "error";
  stage: string;
  message: string;
  details?: Record<string, unknown> | null;
}

type ArticleGraphObserver = (event: ArticleGraphEvent) => void | Promise<void>;

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

const emitGraphEvent = async (observer: ArticleGraphObserver | undefined, event: ArticleGraphEvent): Promise<void> => {
  if (!observer) return;
  await observer(event);
};

const createFetchNode = (observer?: ArticleGraphObserver) => async (state: typeof ArticleState.State) => {
  await assertSafeRemoteUrl(state.url);
  const sourcePolicy = getSourcePolicy(state.url);
  await emitGraphEvent(observer, {
    stage: "graph.fetch",
    message: "Fetching article HTML",
    details: {
      url: state.url,
      sourceDomain: state.sourceDomain,
      fetchTimeoutMs: sourcePolicy.fetchTimeoutMs,
    },
  });
  const html = await fetchHtml(state.url, sourcePolicy.fetchTimeoutMs);
  await emitGraphEvent(observer, {
    stage: "graph.fetch",
    message: "Fetched article HTML",
    details: {
      url: state.url,
      htmlLength: html.length,
    },
  });

  return {
    sourceDomain: getSourceDomain(state.url),
    sourcePolicy,
    html,
  };
};

const createDiagnoseNode = (observer?: ArticleGraphObserver) => async (state: typeof ArticleState.State) => {
  const sourceText = sourceTextForValidation(state.html, state.url);
  const diagnostics = appendDiagnostics(
    state.diagnostics,
    sourceText.length < 240 ? "thin-source-text" : null,
    state.sourcePolicy?.skipLlmWhenBodyMissing && sourceText.length < 240 ? "skip-llm-when-body-missing" : null,
  );
  await emitGraphEvent(observer, {
    stage: "graph.diagnose",
    message: "Diagnosed fetched article payload",
    details: {
      url: state.url,
      sourceTextLength: sourceText.length,
      diagnostics,
    },
  });

  return {
    sourceText,
    diagnostics,
  };
};

const createDeterministicNode = (observer?: ArticleGraphObserver) => async (state: typeof ArticleState.State) => {
  const extracted = deterministicExtract(state.html, state.url);
  const diagnostics = appendDiagnostics(
    state.diagnostics,
    extracted.body.length < 240 ? "deterministic-body-too-short" : null,
  );
  await emitGraphEvent(observer, {
    stage: "graph.deterministic",
    message: "Deterministic extraction completed",
    details: {
      url: state.url,
      titleLength: extracted.title.length,
      bodyLength: extracted.body.length,
      diagnostics,
    },
  });

  return {
    extracted,
    diagnostics,
  };
};

const createDecideFallbackNode = (observer?: ArticleGraphObserver) => async (state: typeof ArticleState.State) => {
  if (!state.extracted) {
    await emitGraphEvent(observer, {
      level: "error",
      stage: "graph.decision",
      message: "No extracted article available after deterministic phase",
      details: { url: state.url },
    });
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
  await emitGraphEvent(observer, {
    level: validation.ok ? "info" : shouldSkipLlmFallback ? "warn" : "info",
    stage: "graph.decision",
    message: validation.ok
      ? "Deterministic extraction passed validation"
      : shouldSkipLlmFallback
        ? "Skipping LLM fallback due to source policy"
        : "Routing article to LLM fallback",
    details: {
      url: state.url,
      validationReason: validation.ok ? null : validationReason,
      shouldSkipLlmFallback,
      diagnostics: state.diagnostics,
    },
  });

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

const createLlmFallbackNode = (observer?: ArticleGraphObserver) => async (state: typeof ArticleState.State) => {
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

  await emitGraphEvent(observer, {
    stage: "graph.llm",
    message: "Waiting for Ollama fallback response",
    details: {
      url: state.url,
      model: appConfig.ollamaModel,
      processingTimeoutMs: state.sourcePolicy.processingTimeoutMs,
      sourceTextLength: state.sourceText.length,
    },
  });
  const fallbackTitle = state.extracted?.title || "";
  const extracted = await llmExtractArticle({
    url: state.url,
    html: state.html,
    sourceText: state.sourceText,
    fallbackTitle,
    processingTimeoutMs: state.sourcePolicy.processingTimeoutMs,
    htmlMaxChars: state.sourcePolicy.llmHtmlMaxChars,
  });
  await emitGraphEvent(observer, {
    stage: "graph.llm",
    message: "Received Ollama fallback response",
    details: {
      url: state.url,
      model: appConfig.ollamaModel,
      titleLength: extracted.title.length,
      bodyLength: extracted.body.length,
    },
  });

  return {
    extracted,
    needsLlm: false,
    usedModel: appConfig.ollamaModel,
    error: null,
    diagnostics: appendDiagnostics(state.diagnostics, "llm-fallback-used"),
  };
};

const createValidateNode = (observer?: ArticleGraphObserver) => async (state: typeof ArticleState.State) => {
  if (!state.extracted) {
    await emitGraphEvent(observer, {
      level: "error",
      stage: "graph.validate",
      message: "Validation failed because no extracted article exists",
      details: { url: state.url },
    });
    return {
      validationReason: "No extracted article available",
      error: "No extracted article available",
      diagnostics: appendDiagnostics(state.diagnostics, "final-empty"),
    };
  }

  const validation = validateExtractionAgainstSource(state.extracted, state.sourceText);
  if (!validation.ok) {
    await emitGraphEvent(observer, {
      level: "warn",
      stage: "graph.validate",
      message: "Final validation failed",
      details: {
        url: state.url,
        reason: validation.reason || "Final validation failed",
      },
    });
    return {
      validationReason: validation.reason || "Final validation failed",
      error: validation.reason || "Final validation failed",
      diagnostics: appendDiagnostics(
        state.diagnostics,
        `final-validation-failed:${validation.reason || "Final validation failed"}`,
      ),
    };
  }

  await emitGraphEvent(observer, {
    stage: "graph.validate",
    message: "Final validation passed",
    details: {
      url: state.url,
      modelUsed: state.usedModel || "deterministic",
    },
  });

  return {
    validationReason: null,
    error: null,
    diagnostics: appendDiagnostics(state.diagnostics, "final-validation-passed"),
  };
};

const createClassifyFailureNode = (observer?: ArticleGraphObserver) => async (state: typeof ArticleState.State) => {
  if (!state.error) {
    return {
      failureClassification: null,
    };
  }

  const failureClassification = classifyFailure(state.error);
  await emitGraphEvent(observer, {
    level: failureClassification === "terminal" ? "warn" : "error",
    stage: "graph.classify",
    message: "Classified graph failure",
    details: {
      url: state.url,
      error: state.error,
      failureClassification,
    },
  });

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

const createArticleGraph = (observer?: ArticleGraphObserver) =>
  new StateGraph(ArticleState)
    .addNode("fetch", createFetchNode(observer))
    .addNode("diagnose", createDiagnoseNode(observer))
    .addNode("deterministic", createDeterministicNode(observer))
    .addNode("decideFallback", createDecideFallbackNode(observer))
    .addNode("llmFallback", createLlmFallbackNode(observer))
    .addNode("validate", createValidateNode(observer))
    .addNode("classifyFailure", createClassifyFailureNode(observer))
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
  observer?: ArticleGraphObserver,
): Promise<{ extracted: ExtractedArticle; modelUsed: string | null }> => {
  const sourcePolicy = getSourcePolicy(url);
  const articleGraph = createArticleGraph(observer);
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
