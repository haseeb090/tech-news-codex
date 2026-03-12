"use client";

import { useState } from "react";

export function IngestionTriggerButton({ onTriggered }: { onTriggered?: () => void }) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onTrigger = async () => {
    setRunning(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/ingest", {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string; status?: string };

      if (!response.ok) {
        setMessage(data.error || "Failed to run ingestion");
      } else {
        setMessage("Ingestion started. The dashboard will update automatically.");
        onTriggered?.();
      }
    } catch {
      setMessage("Request failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onTrigger}
        disabled={running}
        className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {running ? "Running..." : "Run Ingestion Now"}
      </button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
