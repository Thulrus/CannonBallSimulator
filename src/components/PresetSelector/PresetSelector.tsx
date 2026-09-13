import { useEffect, useRef, useState } from 'react'
import { CANNON_PRESETS } from '../../data/cannonPresets'
import { ChevronDown } from '../ui/icons'

export function PresetSelector({
  activeId,
  onApply,
}: {
  activeId: string | null
  onApply: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = CANNON_PRESETS.find((p) => p.id === activeId)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-[12.5px] transition-colors hover:border-ink-600"
      >
        <span className="text-ink-400">Preset</span>
        <span className="max-w-[12rem] truncate font-medium text-ink-50">
          {active?.name ?? 'Custom'}
        </span>
        <ChevronDown
          className={`size-3.5 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-2 w-[min(27rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-700 bg-ink-900/95 shadow-2xl shadow-black/60 backdrop-blur-md sm:right-auto sm:left-0"
        >
          <div className="border-b border-ink-800 px-4 py-2.5 text-[11px] text-ink-400">
            Real specs, loaded into every slider. Compare the result with the historical record.
          </div>
          {CANNON_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onApply(p.id)
                setOpen(false)
              }}
              className={`block w-full border-b border-ink-800 px-4 py-3 text-left transition-colors last:border-0 hover:bg-ink-800/80 ${p.id === activeId ? 'bg-brass-400/5' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-medium text-ink-50">{p.name}</span>
                <span className="shrink-0 text-[11px] text-ink-400">{p.era}</span>
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-300">{p.description}</p>
              <p className="mt-1 font-mono text-[11px] text-brass-300/90">{p.historical}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
