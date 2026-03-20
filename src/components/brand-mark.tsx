export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/8 shadow-[0_10px_30px_rgba(8,145,178,0.18)]">
        <div className="absolute inset-1 rounded-[1rem] bg-[radial-gradient(circle_at_35%_30%,rgba(217,70,239,0.38),transparent_40%),radial-gradient(circle_at_70%_65%,rgba(34,211,238,0.34),transparent_42%)]" />
        <svg viewBox="0 0 48 48" className="relative h-7 w-7 text-white" aria-hidden>
          <circle cx="24" cy="24" r="4" fill="currentColor" />
          <path d="M24 10a14 14 0 0 1 14 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <path d="M24 4a20 20 0 0 1 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
          <path d="M24 16a8 8 0 0 1 8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        </svg>
      </div>

      <div>
        <p className={`font-sans font-bold tracking-[0.05em] text-white ${compact ? "text-base" : "text-lg"}`}>Tech Radar News</p>
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Grounded signal, not sludge</p>
      </div>
    </div>
  );
}
