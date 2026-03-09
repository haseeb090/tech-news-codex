import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { IngestionTriggerButton } from "@/components/admin/ingestion-trigger-button";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { authOptions } from "@/lib/auth/options";
import { getAdminDashboardData } from "@/lib/admin-dashboard";

const fmt = (value: string | null | undefined): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const data = getAdminDashboardData();

  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Ingestion Admin</h1>
            <p className="mt-2 text-sm text-slate-600">Run pipelines manually and inspect failed links.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Back to Feed
            </Link>
            <SignOutButton />
          </div>
        </div>

        <div className="mt-6">
          <IngestionTriggerButton />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last Trigger</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{data.lastRun?.trigger || "N/A"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Processed</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{data.lastRun?.processed || 0}</p>
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Last Run Details</h2>
        {data.lastRun ? (
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-700">Started</dt>
              <dd className="text-slate-600">{fmt(data.lastRun.startedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Finished</dt>
              <dd className="text-slate-600">{fmt(data.lastRun.finishedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Total discovered</dt>
              <dd className="text-slate-600">{data.lastRun.totalLinks}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Queued for processing</dt>
              <dd className="text-slate-600">{data.lastRun.queuedForProcessing}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">New links</dt>
              <dd className="text-slate-600">{data.lastRun.newLinks}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Run ID</dt>
              <dd className="text-slate-600">{data.lastRun.runId}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No ingestion run yet.</p>
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
    </main>
  );
}