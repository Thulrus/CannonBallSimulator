import type { ReactNode } from 'react'

export function ChartCard({
  title,
  subtitle,
  legend,
  children,
  height = 'h-40',
}: {
  title: string
  subtitle?: string
  legend?: { label: string; color: string; dashed?: boolean }[]
  children: ReactNode
  height?: string
}) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/60 px-3 pt-2.5 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[12.5px] font-medium text-ink-100">{title}</h3>
        {legend && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-ink-300">
                <span
                  className="h-0.5 w-3 rounded"
                  style={{
                    background: l.dashed
                      ? `repeating-linear-gradient(90deg, ${l.color} 0 3px, transparent 3px 5px)`
                      : l.color,
                  }}
                />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {subtitle && <p className="text-[11px] leading-snug text-ink-400">{subtitle}</p>}
      <div className={`mt-1.5 ${height}`}>{children}</div>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center">
      <p className="text-[13px] font-medium text-ink-200">{title}</p>
      <div className="mt-1 text-[12px] text-ink-400">{children}</div>
    </div>
  )
}
