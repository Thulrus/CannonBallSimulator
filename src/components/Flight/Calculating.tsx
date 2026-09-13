/** Thin progress bar along the bottom edge of the header. */
export function CalculatingBar({ visible, progress }: { visible: boolean; progress: number }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {progress > 0 ? (
        <div
          className="h-full bg-gradient-to-r from-brass-500 to-brass-300 shadow-[0_0_8px_rgba(234,178,90,0.8)] transition-[width] duration-200 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      ) : (
        <div className="animate-indeterminate h-full w-2/5 bg-gradient-to-r from-transparent via-brass-400 to-transparent" />
      )}
    </div>
  )
}

/** Status pill overlaid on the flight view. */
export function CalculatingBadge({ visible, progress }: { visible: boolean; progress: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-brass-600/40 bg-ink-950/85 px-3 py-1.5 text-[12px] font-medium text-brass-200 shadow-lg shadow-black/40 backdrop-blur-sm transition-all duration-200 ${visible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`}
    >
      {visible && (
        <>
          <svg viewBox="0 0 24 24" className="size-3.5 animate-spin" aria-hidden>
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="3"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          Calculating trajectory…
          {progress > 0 && (
            <span className="w-8 text-right font-mono tabular-nums text-brass-300">
              {Math.round(progress * 100)}%
            </span>
          )}
        </>
      )}
    </div>
  )
}
