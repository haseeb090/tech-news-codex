import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { appConfig } from "@/lib/config";
import { deterministicExtract, fetchHtml, sourceTextForValidation } from "@/lib/ingestion/deterministic-extract";
import { llmExtractArticle } from "@/lib/ingestion/llm-extract";
import { validateExtractionAgainstSource } from "@/lib/ingestion/validation";
import { assertSafeRemoteUrl } from "@/lib/ssrf";
import type { ExtractedArticle } from "@/lib/types";

const ArticleState = Annotation.Root({
  url: Annotation<string>,
  html: Annotation<string>,
  sourceText: Annotation<string>,
  extracted: Annotation<ExtractedArticle | null>,
  needsLlm: Annotation<boolean>,
  usedModel: Annotation<string | null>,
  error: Annotation<string | null>,
});

const deterministicNode = async (state: typeof ArticleState.State) => {
  await assertSafeRemoteUrl(state.url);

  const html = await fetchHtml(state.url);
  const sourceText = sourceTextForValidation(html);
  const extracted = deterministicExtract(html);

  const validation = validateExtractionAgainstSource(extracted, sourceText);

  return {
    html,
    sourceText,
    extracted,
    needsLlm: !validation.ok,
    usedModel: null,
    error: validation.ok ? null : validation.reason || "Deterministic extraction quality gate failed",
  };
};

const llmFallbackNode = async (state: typeof ArticleState.State) => {
  if (!appConfig.useLlmFallback) {
    return {
      needsLlm: false,
      error: state.error || "LLM fallback disabled",
    };
  }

  const fallbackTitle = state.extracted?.title || "";
  const extracted = await llmExtractArticle({
    url: state.url,
    html: state.html,
    fallbackTitle,
  });

  return {
    extracted,
    needsLlm: false,
    usedModel: appConfig.ollamaModel,
    error: null,
  };
};

const validateNode = async (state: typeof ArticleState.State) => {
  if (!state.extracted) {
    return {
      error: "No extracted article available",
    };
  }

  const validation = validateExtractionAgainstSource(state.extracted, state.sourceText);
  if (!validation.ok) {
    return {
      error: validation.reason || "Final validation failed",
    };
  }

  return {
    error: null,
  };
};

const routeAfterDeterministic = (state: typeof ArticleState.State): string => {
  if (state.needsLlm) return "llmFallback";
  return "validate";
};

const articleGraph = new StateGraph(ArticleState)
  .addNode("deterministic", deterministicNode)
  .addNode("llmFallback", llmFallbackNode)
  .addNode("validate", validateNode)
  .addEdge(START, "deterministic")
  .addConditionalEdges("deterministic", routeAfterDeterministic)
  .addEdge("llmFallback", "validate")
  .addEdge("validate", END)
  .compile();

export const runArticleExtractionGraph = async (
  url: string,
): Promise<{ extracted: ExtractedArticle; modelUsed: string | null }> => {
  const result = await articleGraph.invoke({
    url,
    html: "",
    sourceText: "",
    extracted: null,
    needsLlm: false,
    usedModel: null,
    error: null,
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
