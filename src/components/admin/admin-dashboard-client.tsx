"use client";

import { useEffect, useState } from "react";

import { IngestionTriggerButton } from "@/components/admin/ingestion-trigger-button";
import { classifyFailure } from "@/lib/ingestion/failure-classification";
import type {
  ArticleAttemptRecord,
  IngestEventRecord,
  IngestionRunRecord,
  LinkRecord,
  ReaderSignupEventRecord,
} from "@/lib/types";

interface AdminDashboardData {
  activeRun: IngestionRunRecord | null;
  lastRun: IngestionRunRecord | null;
  lastCompletedRun: IngestionRunRecord | null;
  failedLinks: LinkRecord[];
  recentAttempts: ArticleAttemptRecord[];
  currentRunAttempts: ArticleAttemptRecord[];
  timelineRun: IngestionRunRecord | null;
  timelineEvents: IngestEventRecord[];
  totalReaderSignups: number;
  recentReaderSignups: ReaderSignupEventRecord[];
}

interface AdminDashboardClientProps {
  initialData: AdminDashboardData;
}

const fmt = (value: string | null | undefined): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const classificationClasses: Record<ReturnType<typeof classifyFailure>, string> = {
  transient: "border-amber-200 bg-amber-50 text-amber-700",
  terminal: "border-rose-200 bg-rose-50 text-rose-700",
};

const eventLevelClasses: Record<IngestEventRecord["level"], string> = {
  info: "border-cyan-200 bg-cyan-50/80 text-cyan-900",
  warn: "border-amber-200 bg-amber-50/80 text-amber-900",
  error: "border-rose-200 bg-rose-50/80 text-rose-900",
};

const eventStageClasses: Record<IngestEventRecord["level"], string> = {
  info: "border-cyan-300 bg-white text-cyan-900",
  warn: "border-amber-300 bg-white text-amber-900",
  error: "border-rose-300 bg-white text-rose-900",
};

type GraphNodeStatus = "pending" | "running" | "done" | "warn" | "error";

interface GraphLinkStatus {
  key: string;
  linkId: number | null;
  articleUrl: string;
  updatedAt: string;
  currentStage: string;
  finalStatus: "running" | "success" | "failed";
  nodes: Record<GraphNodeKey, GraphNodeStatus>;
}

type GraphNodeKey = "fetch" | "diagnose" | "deterministic" | "decision" | "llm" | "validate" | "rewrite" | "classify" | "result";

const graphNodeLabels: Array<{ key: GraphNodeKey; label: string }> = [
  { key: "fetch", label: "Fetch" },
  { key: "diagnose", label: "Diagnose" },
  { key: "deterministic", label: "Deterministic" },
  { key: "decision", label: "Decision" },
  { key: "llm", label: "LLM" },
  { key: "validate", label: "Validate" },
  { key: "rewrite", label: "Rewrite" },
  { key: "classify", label: "Classify" },
  { key: "result", label: "Result" },
];

const graphNodeStatusClasses: Record<GraphNodeStatus, string> = {
  pending: "border-slate-200 bg-slate-100 text-slate-500",
  running: "border-cyan-300 bg-cyan-100 text-cyan-900",
  done: "border-emerald-300 bg-emerald-100 text-emerald-900",
  warn: "border-amber-300 bg-amber-100 text-amber-900",
  error: "border-rose-300 bg-rose-100 text-rose-900",
};

const finalStatusClasses: Record<GraphLinkStatus["finalStatus"], string> = {
  running: "border-cyan-300 bg-cyan-50 text-cyan-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  failed: "border-rose-300 bg-rose-50 text-rose-900",
};

const graphArrowClasses: Record<GraphNodeStatus, string> = {
  pending: "text-slate-300",
  running: "text-cyan-500",
  done: "text-emerald-500",
  warn: "text-amber-500",
  error: "text-rose-500",
};

const formatEventValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const summarizeEventDetails = (details: Record<string, unknown> | null): Array<[string, string]> => {
  if (!details) return [];

  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 6)
    .map(([key, value]) => [key, formatEventValue(value)]);
};

const createEmptyGraphNodes = (): Record<GraphNodeKey, GraphNodeStatus> => ({
  fetch: "pending",
  diagnose: "pending",
  deterministic: "pending",
  decision: "pending",
  llm: "pending",
  validate: "pending",
  rewrite: "pending",
  classify: "pending",
  result: "pending",
});

const updateGraphNodeState = (
  entry: GraphLinkStatus,
  node: GraphNodeKey,
  status: GraphNodeStatus,
  stage: string,
  createdAt: string,
) => {
  entry.nodes[node] = status;
  entry.currentStage = stage;
  entry.updatedAt = createdAt;
};

const deriveGraphBoard = (events: IngestEventRecord[]): GraphLinkStatus[] => {
  const entries = new Map<string, GraphLinkStatus>();
  const chronological = [...events].reverse();

  for (const event of chronological) {
    if (!event.articleUrl) continue;
    if (!event.stage.startsWith("graph.") && !event.stage.startsWith("link.process.")) continue;

    const key = String(event.linkId ?? event.articleUrl);
    const entry =
      entries.get(key) ??
      (() => {
        const created: GraphLinkStatus = {
          key,
          linkId: event.linkId,
          articleUrl: event.articleUrl,
          updatedAt: event.createdAt,
          currentStage: event.stage,
          finalStatus: "running",
          nodes: createEmptyGraphNodes(),
        };
        entries.set(key, created);
        return created;
      })();

    if (event.stage === "graph.fetch") {
      updateGraphNodeState(entry, "fetch", event.message.startsWith("Fetching") ? "running" : "done", event.stage, event.createdAt);
    } else if (event.stage === "graph.diagnose") {
      updateGraphNodeState(entry, "diagnose", event.level === "warn" ? "warn" : event.level === "error" ? "error" : "done", event.stage, event.createdAt);
    } else if (event.stage === "graph.deterministic") {
      updateGraphNodeState(
        entry,
        "deterministic",
        event.level === "warn" ? "warn" : event.level === "error" ? "error" : "done",
        event.stage,
        event.createdAt,
      );
    } else if (event.stage === "graph.decision") {
      updateGraphNodeState(entry, "decision", event.level === "warn" ? "warn" : event.level === "error" ? "error" : "done", event.stage, event.createdAt);
    } else if (event.stage === "graph.llm") {
      updateGraphNodeState(entry, "llm", event.message.startsWith("Waiting") ? "running" : "done", event.stage, event.createdAt);
    } else if (event.stage === "graph.validate") {
      updateGraphNodeState(entry, "validate", event.level === "warn" ? "warn" : event.level === "error" ? "error" : "done", event.stage, event.createdAt);
    } else if (event.stage === "graph.rewrite") {
      updateGraphNodeState(
        entry,
        "rewrite",
        event.message.startsWith("Rewriting") ? "running" : event.level === "warn" ? "warn" : event.level === "error" ? "error" : "done",
        event.stage,
        event.createdAt,
      );
    } else if (event.stage === "graph.classify") {
      updateGraphNodeState(entry, "classify", event.level === "error" ? "error" : "warn", event.stage, event.createdAt);
    } else if (event.stage === "link.process.start") {
      entry.finalStatus = "running";
      updateGraphNodeState(entry, "result", "running", event.stage, event.createdAt);
    } else if (event.stage === "link.process.success") {
      entry.finalStatus = "success";
      updateGraphNodeState(entry, "result", "done", event.stage, event.createdAt);
    } else if (event.stage === "link.process.failed") {
      entry.finalStatus = "failed";
      updateGraphNodeState(entry, "result", "error", event.stage, event.createdAt);
    }
  }

  return [...entries.values()].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
};

const GraphNodeFlow = ({ entry }: { entry: GraphLinkStatus }) => {
  return (
    <div className="mt-4 overflow-x-auto pb-1">
      <div className="inline-flex min-w-max items-center gap-2">
        {graphNodeLabels.map((node, index) => {
          const status = entry.nodes[node.key];

          return (
            <div key={`${entry.key}-${node.key}`} className="inline-flex items-center gap-2">
              <div className={`min-w-[7rem] rounded-2xl border px-3 py-2 shadow-sm ${graphNodeStatusClasses[status]}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{node.label}</p>
                <p className="mt-1 text-xs font-medium capitalize">{status}</p>
              </div>
              {index < graphNodeLabels.length - 1 ? (
                <div className={`text-lg font-bold ${graphArrowClasses[status]}`} aria-hidden="true">
                  {"->"}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export function AdminDashboardClient({ initialData }: AdminDashboardClientProps) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/admin/ingest/status", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as AdminDashboardData;
        if (!cancelled) {
          setData(next);
        }
      } catch {
        // Ignore transient polling errors.
      }
    };

    void load();

    const interval = window.setInterval(() => {
      void load();
    }, data.activeRun?.status === "running" ? 2500 : 12000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [data.activeRun?.status]);

  const refresh = async () => {
    try {
      const response = await fetch("/api/admin/ingest/status", { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as AdminDashboardData;
      setData(next);
    } catch {
      // Ignore transient polling errors.
    }
  };

  const summaryRun = data.activeRun ?? data.lastCompletedRun ?? data.lastRun;
  const timelineLabel = data.activeRun
    ? `Live pipeline timeline for run #${data.activeRun.runId}`
    : data.timelineRun
      ? `Latest stored pipeline timeline for run #${data.timelineRun.runId}`
      : "Pipeline timeline";
  const graphBoard = deriveGraphBoard(data.timelineEvents);

  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Ingestion Admin</h1>
            <p className="mt-2 text-sm text-slate-600">Run pipelines manually, monitor progress, and inspect failures.</p>
          </div>
          <IngestionTriggerButton
            onTriggered={() => void refresh()}
            disabled={Boolean(data.activeRun)}
            disabledReason={
              data.activeRun
                ? "A run is already active. Wait for it to finish or inspect the live timeline below."
                : null
            }
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Current Status</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {data.activeRun ? `Running (${data.activeRun.processed}/${data.activeRun.queuedForProcessing})` : "Idle"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last Trigger</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{summaryRun?.trigger || "N/A"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Succeeded</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {data.activeRun ? data.activeRun.succeeded : data.lastCompletedRun?.succeeded || 0}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Failed</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">
            {data.activeRun ? data.activeRun.failed : data.lastCompletedRun?.failed || 0}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reader Signups</p>
          <p className="mt-3 text-4xl font-bold text-slate-900">{data.totalReaderSignups}</p>
          <p className="mt-2 text-sm text-slate-600">Tracked free reader accounts created through the gated feed experience.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Recent Signups</h2>
          {data.recentReaderSignups.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No reader signups recorded yet.</p>
          ) : (
            <div className="mt-4 max-h-[18rem] overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="py-3 pl-4">Time</th>
                    <th className="py-3">Email</th>
                    <th className="py-3">Origin</th>
                    <th className="py-3 pr-4">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentReaderSignups.map((signup) => (
                    <tr key={signup.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pl-4 pr-4">{fmt(signup.createdAt)}</td>
                      <td className="py-3 pr-4 text-slate-700">{signup.email}</td>
                      <td className="py-3 pr-4 text-slate-600">{signup.origin || "-"}</td>
                      <td className="py-3 pr-4 text-slate-600">{signup.ipAddress || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {data.activeRun ? (
        <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Active Run</h2>
          <p className="mt-2 text-sm text-slate-700">
            The pipeline is live. Feed discovery, per-link orchestration, LangGraph node transitions, and export steps stream below.
          </p>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-700">Started</dt>
              <dd className="text-slate-600">{fmt(data.activeRun.startedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Progress</dt>
              <dd className="text-slate-600">
                {data.activeRun.processed} / {data.activeRun.queuedForProcessing}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Current Item</dt>
              <dd className="break-all text-slate-600">{data.activeRun.currentItemUrl || "-"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Last Error</dt>
              <dd className="text-slate-600">{data.activeRun.lastError || "-"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Last Completed Run</h2>
        {data.lastCompletedRun ? (
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-700">Started</dt>
              <dd className="text-slate-600">{fmt(data.lastCompletedRun.startedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Finished</dt>
              <dd className="text-slate-600">{fmt(data.lastCompletedRun.finishedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Total discovered</dt>
              <dd className="text-slate-600">{data.lastCompletedRun.totalLinks}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Queued for processing</dt>
              <dd className="text-slate-600">{data.lastCompletedRun.queuedForProcessing}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">New links</dt>
              <dd className="text-slate-600">{data.lastCompletedRun.newLinks}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Status</dt>
              <dd className="text-slate-600">{data.lastCompletedRun.status}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No completed ingestion run yet.</p>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Pipeline Timeline</h2>
            <p className="mt-2 text-sm text-slate-600">{timelineLabel}</p>
          </div>
          {data.timelineRun ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Run #{data.timelineRun.runId}</p>
              <p>
                {data.timelineRun.processed} / {data.timelineRun.queuedForProcessing} processed
              </p>
            </div>
          ) : null}
        </div>

        {data.timelineEvents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No pipeline events recorded yet.</p>
        ) : (
          <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-2">
            {data.timelineEvents.map((event) => {
              const detailPairs = summarizeEventDetails(event.details);

              return (
                <article key={event.id} className={`rounded-2xl border p-4 shadow-sm ${eventLevelClasses[event.level]}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${eventStageClasses[event.level]}`}
                        >
                          {event.stage}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{event.level}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{event.message}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>{fmt(event.createdAt)}</p>
                      {event.linkId ? <p>Link #{event.linkId}</p> : null}
                    </div>
                  </div>

                  {event.articleUrl ? <p className="mt-3 break-all text-sm text-slate-700">{event.articleUrl}</p> : null}

                  {detailPairs.length > 0 ? (
                    <dl className="mt-4 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                      {detailPairs.map(([key, value]) => (
                        <div key={`${event.id}-${key}`} className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                          <dt className="font-semibold uppercase tracking-[0.14em] text-slate-500">{key}</dt>
                          <dd className="mt-1 break-all text-slate-800">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">LangGraph Orchestration</h2>
            <p className="mt-2 text-sm text-slate-600">
              Per-link node state for the extraction graph. This highlights fetch, diagnose, deterministic extraction, fallback decisions, validation, rewrite generation, and final result.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{graphBoard.length} tracked links</p>
            <p>{data.activeRun ? "Streaming current run" : "Showing latest stored run"}</p>
          </div>
        </div>

        {graphBoard.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No graph-node events recorded yet.</p>
        ) : (
          <div className="mt-5 max-h-[34rem] space-y-4 overflow-y-auto pr-2">
            {graphBoard.map((entry) => (
              <article key={entry.key} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${finalStatusClasses[entry.finalStatus]}`}
                      >
                        {entry.finalStatus}
                      </span>
                      {entry.linkId ? (
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Link #{entry.linkId}</span>
                      ) : null}
                    </div>
                    <p className="break-all text-sm font-semibold text-slate-900">{entry.articleUrl}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest stage: {entry.currentStage}</p>
                  </div>
                  <p className="text-right text-xs text-slate-500">{fmt(entry.updatedAt)}</p>
                </div>

                <GraphNodeFlow entry={entry} />
              </article>
            ))}
          </div>
        )}
      </section>

      {data.activeRun ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Current Run Attempts</h2>
          <p className="mt-2 text-sm text-slate-600">
            These are the article-level results for the active run only, so you can watch successes and failures without losing the broader history.
          </p>
          {data.currentRunAttempts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No article attempts recorded for the current run yet.</p>
          ) : (
            <div className="mt-4 max-h-[28rem] overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="py-3 pl-4">Time</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Model</th>
                    <th className="py-3">Duration</th>
                    <th className="py-3">URL</th>
                    <th className="py-3 pr-4">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.currentRunAttempts.map((attempt) => (
                    <tr key={attempt.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pl-4 pr-4">{fmt(attempt.createdAt)}</td>
                      <td className={`py-3 pr-4 font-semibold ${attempt.status === "success" ? "text-emerald-700" : "text-rose-700"}`}>
                        {attempt.status}
                      </td>
                      <td className="py-3 pr-4">{attempt.modelUsed || "deterministic"}</td>
                      <td className="py-3 pr-4">{attempt.durationMs} ms</td>
                      <td className="py-3 pr-4 break-all text-slate-600">{attempt.articleUrl}</td>
                      <td className="py-3 pr-4 text-rose-700">{attempt.errorMessage || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Recent Attempts</h2>
        <p className="mt-2 text-sm text-slate-600">
          Cross-run history for the latest extraction attempts. This stays visible while the current run keeps streaming above.
        </p>
        {data.recentAttempts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No attempts recorded yet.</p>
        ) : (
          <div className="mt-4 max-h-[32rem] overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="py-3 pl-4">Time</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Model</th>
                  <th className="py-3">Duration</th>
                  <th className="py-3">URL</th>
                  <th className="py-3 pr-4">Run</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAttempts.map((attempt) => (
                  <tr key={attempt.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pl-4 pr-4">{fmt(attempt.createdAt)}</td>
                    <td className={`py-3 pr-4 font-semibold ${attempt.status === "success" ? "text-emerald-700" : "text-rose-700"}`}>
                      {attempt.status}
                    </td>
                    <td className="py-3 pr-4">{attempt.modelUsed || "deterministic"}</td>
                    <td className="py-3 pr-4">{attempt.durationMs} ms</td>
                    <td className="py-3 pr-4 break-all text-slate-600">{attempt.articleUrl}</td>
                    <td className="py-3 pr-4 text-slate-600">#{attempt.runId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Failed Links</h2>
        {data.failedLinks.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No failed links.</p>
        ) : (
          <div className="mt-4 max-h-[28rem] overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="py-3 pl-4">Source</th>
                  <th className="py-3">URL</th>
                  <th className="py-3">Retries</th>
                  <th className="py-3">Next Retry</th>
                  <th className="py-3 pr-4">Error</th>
                </tr>
              </thead>
              <tbody>
                {data.failedLinks.map((link) => {
                  const classification = classifyFailure(link.lastError || "");

                  return (
                    <tr key={link.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pl-4 pr-4">{link.sourceDomain}</td>
                      <td className="py-3 pr-4 text-sky-700">
                        <a href={link.normalizedUrl} target="_blank" rel="noreferrer" className="line-clamp-2 hover:underline">
                          {link.normalizedUrl}
                        </a>
                      </td>
                      <td className="py-3 pr-4">{link.retryCount}</td>
                      <td className="py-3 pr-4">{fmt(link.nextRetryAt)}</td>
                      <td className="py-3 pr-4">
                        <div className="space-y-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${classificationClasses[classification]}`}
                          >
                            {classification}
                          </span>
                          <p className="text-rose-700">{link.lastError || "Unknown"}</p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

