import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";

import { appConfig } from "@/lib/config";
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
  fallbackTitle: string;
}): Promise<ExtractedArticle> => {
  const structured = llm.withStructuredOutput(extractionSchema);

  const prompt = `You extract factual fields from raw article HTML.
Rules:
- Do not invent information.
- Use only facts present in the input.
- Keep body as clean article text, not summary, minimum 280 characters.
- If writer or published date is missing, return null.

URL: ${params.url}
Fallback title: ${params.fallbackTitle}

HTML (possibly truncated):
${params.html.slice(0, 45_000)}`;

  const result = await structured.invoke(prompt);

  return {
    title: result.title,
    body: result.body,
    writer: result.writer,
    publishedAt: result.publishedAt,
  };
};