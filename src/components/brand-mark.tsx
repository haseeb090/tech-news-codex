export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/8 shadow-[0_10px_30px_rgba(8,145,178,0.18)]">
        <div className="absolute inset-1 rounded-[1rem] bg-[radial-gradient(circle_at_35%_30%,rgba(244,114,182,0.34),transparent_40%),radial-gradient(circle_at_70%_65%,rgba(34,211,238,0.34),transparent_42%)]" />
        <svg viewBox="0 0 48 48" className="relative h-7 w-7 text-white" aria-hidden>
          <path d="M24 4 37 12v24L24 44 11 36V12Z" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
          <path d="M24 4v15m0 25V29m13-17-13 7-13-7m26 24-13-7-13 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.72" />
          <circle cx="24" cy="24" r="4.2" fill="currentColor" />
        </svg>
      </div>

      <div>
        <p className={`font-sans font-bold tracking-[0.05em] text-white ${compact ? "text-base" : "text-lg"}`}>Rubix Signal</p>
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Rewritten tech briefings</p>
      </div>
    </div>
  );
}
