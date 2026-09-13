import type { CSSProperties } from 'react'
import { playback, usePlaybackState, type PlaybackRate } from '../../lib/playback'
import { FlameIcon, PauseIcon, PlayIcon, RestartIcon } from '../ui/icons'
import { Select } from '../ui/controls'

const RATES: PlaybackRate[] = ['auto', 0.25, 0.5, 1, 2, 5, 10, 25, 50]

export function PlaybackBar({ onFire }: { onFire: () => void }) {
  const s = usePlaybackState()
  const pct = s.duration > 0 ? (s.time / s.duration) * 100 : 0
  const autoRate = playback.effectiveRate()

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-ink-800 bg-ink-900/80 px-3 py-2.5">
      <button
        type="button"
        onClick={onFire}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-brass-300 to-brass-500 px-4 py-2 text-[13px] font-semibold text-ink-950 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_8px_24px_-10px_rgba(234,178,90,0.9)] transition hover:from-brass-200 hover:to-brass-400 active:translate-y-px"
      >
        <FlameIcon className="size-4" />
        Fire
        <kbd className="rounded bg-ink-950/15 px-1 font-mono text-[10px]">F</kbd>
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={s.playing ? 'Pause' : 'Play'}
        onClick={() => playback.toggle()}
      >
        {s.playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Replay from launch"
        onClick={() => playback.fire()}
      >
        <RestartIcon className="size-4" />
      </button>

      <input
        type="range"
        aria-label="Scrub flight time"
        className="range min-w-[8rem] flex-1"
        min={0}
        max={s.duration || 1}
        step={(s.duration || 1) / 1000}
        value={s.time}
        style={{ '--fill': `${pct}%` } as CSSProperties}
        onChange={(e) => {
          playback.pause()
          playback.seek(Number(e.target.value))
        }}
      />

      <span className="w-[8.5rem] text-right font-mono text-[12px] text-ink-200 tabular-nums">
        {s.time.toFixed(2)}
        <span className="text-ink-500"> / {s.duration.toFixed(1)} s</span>
      </span>

      <Select
        compact
        className="w-[6.75rem]"
        value={String(s.rate)}
        onChange={(v) => playback.setRate(v === 'auto' ? 'auto' : Number(v))}
        options={RATES.map((r) => ({
          value: String(r),
          label:
            r === 'auto'
              ? `Auto ×${autoRate < 10 ? autoRate.toFixed(1) : Math.round(autoRate)}`
              : `×${r}`,
        }))}
      />
    </div>
  )
}
