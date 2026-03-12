"use client";

import { useEffect, useState } from "react";

import { IngestionTriggerButton } from "@/components/admin/ingestion-trigger-button";
import type { ArticleAttemptRecord, IngestionRunRecord, LinkRecord } from "@/lib/types";

interface AdminDashboardData {
  activeRun: IngestionRunRecord | null;
  lastRun: IngestionRunRecord | null;
  failedLinks: LinkRecord[];
  recentAttempts: ArticleAttemptRecord[];
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
      if (data.activeRun?.status === "running") {
        void load();
      }
    }, 5000);

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

  const lastCompletedRun =
    data.lastRun?.status === "completed" || data.lastRun?.status === "failed"
      ? data.lastRun
      : data.activeRun?.runId === data.lastRun?.runId
        ? null
        : data.lastRun;

  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Ingestion Admin</h1>
            <p className="mt-2 text-sm text-slate-600">Run pipelines manually, monitor progress, and inspect failures.</p>
          </div>
          <IngestionTriggerButton onTriggered={() => void refresh()} />
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
          <p className="mt-2 text-sm font-semibold text-slate-900">{data.lastRun?.trigger || "N/A"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Succeeded</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{data.lastRun?.succeeded || 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Failed</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{data.lastRun?.failed || 0}</p>
        </div>
      </section>

      {data.activeRun ? (
        <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Active Run</h2>
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
        <h2 className="text-2xl font-bold text-slate-900">Last Run Details</h2>
        {lastCompletedRun ? (
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-700">Started</dt>
              <dd className="text-slate-600">{fmt(lastCompletedRun.startedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Finished</dt>
              <dd className="text-slate-600">{fmt(lastCompletedRun.finishedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Total discovered</dt>
              <dd className="text-slate-600">{lastCompletedRun.totalLinks}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Queued for processing</dt>
              <dd className="text-slate-600">{lastCompletedRun.queuedForProcessing}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">New links</dt>
              <dd className="text-slate-600">{lastCompletedRun.newLinks}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Status</dt>
              <dd className="text-slate-600">{lastCompletedRun.status}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No completed ingestion run yet.</p>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Recent Attempts</h2>
        {data.recentAttempts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No attempts recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="py-2">Time</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Model</th>
                  <th className="py-2">Duration</th>
                  <th className="py-2">URL</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAttempts.map((attempt) => (
                  <tr key={attempt.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-4">{fmt(attempt.createdAt)}</td>
                    <td className={`py-2 pr-4 font-semibold ${attempt.status === "success" ? "text-emerald-700" : "text-rose-700"}`}>
                      {attempt.status}
                    </td>
                    <td className="py-2 pr-4">{attempt.modelUsed || "deterministic"}</td>
                    <td className="py-2 pr-4">{attempt.durationMs} ms</td>
                    <td className="py-2 break-all text-slate-600">{attempt.articleUrl}</td>
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
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="py-2">Source</th>
                  <th className="py-2">URL</th>
                  <th className="py-2">Retries</th>
                  <th className="py-2">Next Retry</th>
                  <th className="py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {data.failedLinks.map((link) => (
                  <tr key={link.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-4">{link.sourceDomain}</td>
                    <td className="py-2 pr-4 text-sky-700">
                      <a href={link.normalizedUrl} target="_blank" rel="noreferrer" className="line-clamp-2 hover:underline">
                        {link.normalizedUrl}
                      </a>
                    </td>
                    <td className="py-2 pr-4">{link.retryCount}</td>
                    <td className="py-2 pr-4">{fmt(link.nextRetryAt)}</td>
                    <td className="py-2 text-rose-700">{link.lastError || "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
