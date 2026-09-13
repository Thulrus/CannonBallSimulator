import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { clamp } from '../../lib/misc'
import {
  displayUnit,
  formatQuantity,
  fromDisplay,
  roundSig,
  toDisplay,
  type Quantity,
  type UnitSystem,
} from '../../lib/units'
import { ChevronDown } from './icons'

const LOG_RESOLUTION = 1000

export interface SliderProps {
  label: string
  /** Value in SI units. */
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  quantity: Quantity
  units: UnitSystem
  scale?: 'linear' | 'log'
  digits?: number
  hint?: ReactNode
  /** A reference tick on the track, e.g. the optimal barrel length. */
  marker?: { value: number; label: string }
  disabled?: boolean
}

/**
 * Labelled range slider with a live readout. The readout doubles as a text field:
 * click it to type an exact value in display units.
 */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  quantity,
  units,
  scale = 'linear',
  digits,
  hint,
  marker,
  disabled,
}: SliderProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const unit = displayUnit(units, quantity)

  const toPos = (v: number) =>
    scale === 'log' ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min)
  const fromPos = (p: number) =>
    scale === 'log' ? min * Math.pow(max / min, p) : min + p * (max - min)
  const pos = clamp(toPos(value), 0, 1)

  const commit = () => {
    if (draft !== null) {
      const n = Number.parseFloat(draft)
      if (Number.isFinite(n)) onChange(clamp(fromDisplay(unit, n), min, max))
    }
    setDraft(null)
  }

  return (
    <div className={disabled ? 'opacity-45' : undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] text-ink-300">
          {label}
        </label>
        {draft === null ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setDraft(String(roundSig(toDisplay(unit, value), 6)))}
            title="Click to type an exact value"
            className="-mr-1 rounded px-1 font-mono text-[12.5px] text-ink-50 tabular-nums hover:bg-ink-800 disabled:hover:bg-transparent"
          >
            {formatQuantity(units, quantity, value, { digits, magnitude: 0 })}
          </button>
        ) : (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              inputMode="decimal"
              aria-label={`${label} (${unit.label})`}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setDraft(null)
              }}
              className="w-20 rounded border border-brass-500 bg-ink-950 px-1.5 py-0.5 text-right font-mono text-[12px] text-ink-50 outline-none"
            />
            <span className="text-[11px] text-ink-400">{unit.label}</span>
          </span>
        )}
      </div>
      <div className="relative mt-0.5">
        <input
          id={id}
          type="range"
          className="range"
          disabled={disabled}
          style={{ '--fill': `${pos * 100}%` } as CSSProperties}
          min={scale === 'log' ? 0 : min}
          max={scale === 'log' ? LOG_RESOLUTION : max}
          step={scale === 'log' ? 1 : (step ?? (max - min) / 500)}
          value={scale === 'log' ? Math.round(pos * LOG_RESOLUTION) : clamp(value, min, max)}
          onChange={(e) => {
            const raw = Number(e.target.value)
            onChange(scale === 'log' ? roundSig(fromPos(raw / LOG_RESOLUTION), 3) : raw)
          }}
        />
        {marker && (
          <span
            className="pointer-events-none absolute top-[3px] h-3 w-0.5 -translate-x-1/2 rounded-full bg-emerald-400/90"
            style={{ left: `calc(7px + ${clamp(toPos(marker.value), 0, 1)} * (100% - 14px))` }}
            title={marker.label}
          />
        )}
      </div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-ink-400">{hint}</div>}
    </div>
  )
}

export function Section({
  title,
  icon,
  children,
  defaultOpen = true,
  aside,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  aside?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-ink-800/80">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-ink-900/70"
      >
        <span className="text-brass-400">{icon}</span>
        <span className="text-[11px] font-semibold tracking-[0.14em] text-ink-200 uppercase">
          {title}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {aside}
          <ChevronDown
            className={`size-4 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {open && <div className="space-y-4 px-4 pt-1 pb-5">{children}</div>}
    </section>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  description,
  accent,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
  accent?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start gap-3 rounded-md text-left"
    >
      <span
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-brass-500' : 'bg-ink-700 group-hover:bg-ink-600'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-ink-50 shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
        />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] text-ink-100">
          {accent && <span className="size-2 rounded-full" style={{ background: accent }} />}
          {label}
        </span>
        {description && (
          <span className="block text-[11px] leading-snug text-ink-400">{description}</span>
        )}
      </span>
    </button>
  )
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  compact,
  className = '',
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  compact?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-[12.5px] text-ink-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={`w-full appearance-none rounded-md border border-ink-700 bg-ink-900 pr-7 text-ink-100 transition-colors hover:border-ink-600 focus:border-brass-500 focus:outline-none ${compact ? 'py-1 pl-2 text-[12px]' : 'py-1.5 pl-2.5 text-[13px]'}`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-ink-400" />
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-ink-700 bg-ink-900 p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-medium transition-colors ${size === 'sm' ? 'px-2 py-1 text-[11.5px]' : 'px-2.5 py-1 text-[12.5px]'} ${active ? 'bg-ink-700 text-ink-50 shadow-sm' : 'text-ink-400 hover:text-ink-200'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function ToggleChip({
  label,
  active,
  onClick,
  swatch,
}: {
  label: string
  active: boolean
  onClick: () => void
  swatch?: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${active ? 'border-brass-600/70 bg-brass-400/10 text-brass-200' : 'border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-200'}`}
    >
      {swatch}
      {label}
    </button>
  )
}

/** Numeric input bound to an SI value but edited in display units. */
export function NumberField({
  label,
  value,
  onChange,
  quantity,
  units,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  quantity: Quantity
  units: UnitSystem
}) {
  const id = useId()
  const unit = displayUnit(units, quantity)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(roundSig(toDisplay(unit, value), 5))
  const commit = () => {
    if (draft === null) return
    const n = Number.parseFloat(draft)
    if (Number.isFinite(n)) onChange(fromDisplay(unit, n))
    setDraft(null)
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11.5px] text-ink-400">
        {label}
      </label>
      <div className="flex items-center rounded-md border border-ink-700 bg-ink-900 focus-within:border-brass-500">
        <input
          id={id}
          value={shown}
          inputMode="decimal"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="w-full min-w-0 bg-transparent px-2 py-1.5 font-mono text-[12.5px] text-ink-50 outline-none"
        />
        {unit.label && <span className="pr-2 text-[11px] text-ink-400">{unit.label}</span>}
      </div>
    </div>
  )
}

/**
 * Drag-to-set compass dial for wind direction. The rim marker is where the wind comes
 * *from* (meteorological convention); the arrow shows where it blows; the dashed brass
 * line is the cannon's heading.
 */
export function CompassInput({
  label,
  value,
  onChange,
  azimuth,
  disabled,
  children,
}: {
  label: string
  value: number
  onChange: (deg: number) => void
  azimuth: number
  disabled?: boolean
  children?: ReactNode
}) {
  const ref = useRef<SVGSVGElement>(null)

  const setFromPointer = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (deg < 0) deg += 360
    onChange((Math.round(deg / 5) * 5) % 360)
  }

  return (
    <div className={`flex items-center gap-4 ${disabled ? 'pointer-events-none opacity-45' : ''}`}>
      <svg
        ref={ref}
        viewBox="-50 -50 100 100"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={value}
        aria-valuetext={`from ${value}°`}
        className="size-[92px] shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setFromPointer(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) setFromPointer(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange((value + 5) % 360)
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange((value + 355) % 360)
        }}
      >
        <circle r="46" className="fill-ink-900 stroke-ink-700" strokeWidth="1.5" />
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            y1={-46}
            y2={i % 6 === 0 ? -39 : -42.5}
            transform={`rotate(${i * 15})`}
            className="stroke-ink-600"
            strokeWidth={i % 6 === 0 ? 1.5 : 1}
          />
        ))}
        {(['N', 'E', 'S', 'W'] as const).map((d, i) => {
          const a = (i * Math.PI) / 2
          return (
            <text
              key={d}
              x={Math.sin(a) * 31}
              y={-Math.cos(a) * 31 + 3.5}
              textAnchor="middle"
              className="fill-ink-400 font-sans"
              fontSize="9"
              fontWeight="600"
            >
              {d}
            </text>
          )
        })}
        <line
          y2={-44}
          transform={`rotate(${azimuth})`}
          className="stroke-brass-400"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <g transform={`rotate(${value})`}>
          <circle cy={-42} r="3.5" className="fill-sky-300" />
          <line
            y1={-34}
            y2={18}
            className="stroke-sky-300"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M-6 14 L0 26 L6 14 Z" className="fill-sky-300" />
        </g>
        <circle r="2.5" className="fill-ink-100" />
      </svg>
      <div className="min-w-0 text-[11.5px] leading-relaxed text-ink-400">{children}</div>
    </div>
  )
}
