import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";

import { appConfig } from "@/lib/config";
import { normalizeHtmlForExtraction } from "@/lib/ingestion/deterministic-extract";
import type { ExtractedArticle } from "@/lib/types";

const extractionSchema = z.object({
  title: z.string().min(12),
  body: z.string().min(280),
  writer: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

const llm = new ChatOllama({
  baseUrl: appConfig.ollamaBaseUrl,
  model: appConfig.ollamaModel,
  temperature: 0,
});

export const llmExtractArticle = async (params: {
  url: string;
  html: string;
  sourceText?: string;
  fallbackTitle: string;
  processingTimeoutMs?: number;
  htmlMaxChars?: number;
}): Promise<ExtractedArticle> => {
  const structured = llm.withStructuredOutput(extractionSchema);
  const promptSource = (params.sourceText?.trim() || normalizeHtmlForExtraction(params.html)).slice(
    0,
    params.htmlMaxChars ?? appConfig.llmHtmlMaxChars,
  );

  const prompt = `You extract factual article fields from source content taken from a news page.
Rules:
- Do not invent information.
- Use only facts present in the input.
- Keep body as clean article text, not summary, minimum 280 characters.
- Exclude navigation, newsletter prompts, ads, related links, footers, cookie banners, and comment sections.
- Prefer the main article body only, preserving the original wording as much as possible.
- If writer or published date is missing, return null.

URL: ${params.url}
Fallback title: ${params.fallbackTitle}

Source content (possibly truncated):
${promptSource}`;

  const result = await structured.invoke(prompt, {
    signal: AbortSignal.timeout(params.processingTimeoutMs ?? appConfig.articleProcessTimeoutMs),
  });

  return {
    title: result.title,
    body: result.body,
    writer: result.writer,
    publishedAt: result.publishedAt,
  };
};
