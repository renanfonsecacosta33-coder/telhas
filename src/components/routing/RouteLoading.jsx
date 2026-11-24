import React from "react";

export default function RouteLoading({ compact = false }) {
  return (
    <div role="status" aria-live="polite" className={compact ? "rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg" : "min-h-screen bg-background p-6 text-foreground"}>
      <p className="text-sm font-semibold">{compact ? "Abrindo detalhes…" : "Abrindo tela…"}</p>
      <div aria-hidden="true" className="mt-4 space-y-3">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="h-3 w-56 max-w-full rounded bg-muted" />
        {!compact && <div className="h-32 rounded-xl border border-border bg-card" />}
      </div>
    </div>
  );
}