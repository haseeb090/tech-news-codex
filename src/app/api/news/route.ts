import { NextRequest, NextResponse } from "next/server";

import { loadExportedNews } from "@/lib/export-news";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") || "").trim().toLowerCase();
  const source = (searchParams.get("source") || "").trim().toLowerCase();
  const limit = Number.parseInt(searchParams.get("limit") || "100", 10);

  const rows = await loadExportedNews();

  let filtered = rows;

  if (source) {
    filtered = filtered.filter((row) => String(row.source || "").toLowerCase() === source);
  }

  if (query) {
    filtered = filtered.filter((row) => {
      const haystack = `${row.title || ""} ${row.body || ""} ${row.writer || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100;

  return NextResponse.json({
    count: filtered.length,
    items: filtered.slice(0, safeLimit),
  });
}