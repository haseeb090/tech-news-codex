import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { authOptions } from "@/lib/auth/options";
import { getAdminDashboardData } from "@/lib/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const data = await getAdminDashboardData();

  return (
    <main id="main-content" className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Controls</h1>
            <p className="mt-2 text-sm text-slate-600">
              Secure controls for the Rubix Signal ingestion, rewrite, and export pipeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Back to Feed
            </Link>
            <SignOutButton />
          </div>
        </div>
      </section>

      <AdminDashboardClient initialData={data} />
    </main>
  );
}
