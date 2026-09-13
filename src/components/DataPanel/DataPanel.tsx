import { lazy, Suspense, useState } from 'react'
import type { PinnedShot } from '../../lib/misc'
import type { UnitSystem } from '../../lib/units'
import type { SimulationConfig, SimulationResult } from '../../physics/simulate'
import { ExportPanel } from './ExportPanel'
import { SummaryStats } from './SummaryStats'

// Recharts is most of the bundle; only fetch it once a chart tab is opened.
const TimeSeriesCharts = lazy(() =>
  import('./TimeSeriesCharts').then((m) => ({ default: m.TimeSeriesCharts })),
)
const SweepPanel = lazy(() => import('./SweepPanel').then((m) => ({ default: m.SweepPanel })))
const ComparePanel = lazy(() => import('./ComparePanel').then((m) => ({ default: m.ComparePanel })))

type Tab = 'summary' | 'charts' | 'sweep' | 'compare' | 'export'

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'charts', label: 'Charts' },
  { id: 'sweep', label: 'Sweep' },
  { id: 'compare', label: 'Compare' },
  { id: 'export', label: 'Export' },
]

interface Props {
  config: SimulationConfig
  result: SimulationResult
  aim: SimulationResult | null
  units: UnitSystem
  shots: PinnedShot[]
  onPin: () => void
  onToggleShot: (id: number) => void
  onRemoveShot: (id: number) => void
  onLoadShot: (id: number) => void
  onClearShots: () => void
}

export function DataPanel(props: Props) {
  const [tab, setTab] = useState<Tab>('summary')
  // The sweep keeps its worker and last result while you look at other tabs, but
  // isn't mounted at all until first visited.
  const [sweepVisited, setSweepVisited] = useState(false)
  const { result, units } = props

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Data views"
        className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-ink-800 px-2"
      >
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t.id)
                if (t.id === 'sweep') setSweepVisited(true)
              }}
              className={`relative flex items-center gap-1.5 px-3 py-3 text-[12.5px] font-medium whitespace-nowrap transition-colors ${active ? 'text-ink-50' : 'text-ink-400 hover:text-ink-200'}`}
            >
              {t.label}
              {t.id === 'compare' && props.shots.length > 0 && (
                <span className="rounded-full bg-ink-700 px-1.5 text-[10px] text-ink-200 tabular-nums">
                  {props.shots.length}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brass-400" />
              )}
            </button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
        <Suspense
          fallback={<p className="animate-pulse text-[12px] text-ink-400">Loading charts…</p>}
        >
          {tab === 'summary' && <SummaryStats result={result} aim={props.aim} units={units} />}
          {tab === 'charts' && <TimeSeriesCharts result={result} units={units} />}
          {sweepVisited && (
            <div hidden={tab !== 'sweep'}>
              <SweepPanel config={props.config} units={units} active={tab === 'sweep'} />
            </div>
          )}
          {tab === 'compare' && (
            <ComparePanel
              result={result}
              shots={props.shots}
              units={units}
              onPin={props.onPin}
              onToggle={props.onToggleShot}
              onRemove={props.onRemoveShot}
              onLoad={props.onLoadShot}
              onClear={props.onClearShots}
            />
          )}
          {tab === 'export' && <ExportPanel result={result} />}
        </Suspense>
      </div>
    </div>
  )
}
