import { useMemo, useState } from 'react'
import { downloadText } from '../../lib/misc'
import { shareUrl } from '../../lib/share'
import { toCsv } from '../../physics/csv'
import type { SimulationResult } from '../../physics/simulate'
import { CopyIcon, DownloadIcon, LinkIcon } from '../ui/icons'

export function ExportPanel({ result }: { result: SimulationResult }) {
  const csv = useMemo(() => toCsv(result), [result])
  const [flash, setFlash] = useState<string | null>(null)

  const lines = csv.trim().split('\n')
  const columnRow = lines.findIndex((l) => l.startsWith('t_s,'))
  const header = lines[columnRow].split(',')
  const preview = lines.slice(columnRow + 1, columnRow + 7).map((l) => l.split(','))
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setFlash(`${what} copied to clipboard`)
    } catch {
      setFlash('Clipboard unavailable in this browser')
    }
    window.setTimeout(() => setFlash(null), 2200)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3">
        <h3 className="text-[13px] font-medium text-ink-50">Time-series CSV</h3>
        <p className="mt-0.5 text-[12px] text-ink-400">
          {result.samples.length.toLocaleString()} rows × {header.length} columns, always in SI
          units, with the configuration recorded in a commented header.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => downloadText(`cannonball-${stamp}.csv`, csv)}
          >
            <DownloadIcon className="size-3.5" /> Download CSV
          </button>
          <button type="button" className="btn" onClick={() => copy(csv, 'CSV')}>
            <CopyIcon className="size-3.5" /> Copy CSV
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3">
        <h3 className="text-[13px] font-medium text-ink-50">Share this configuration</h3>
        <p className="mt-0.5 text-[12px] text-ink-400">
          The link encodes every input, so it opens exactly this shot. The address bar stays in sync
          as you edit.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => copy(shareUrl(result.config), 'Link')}
          >
            <LinkIcon className="size-3.5" /> Copy share link
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadText(
                `cannonball-config-${stamp}.json`,
                JSON.stringify(result.config, null, 2),
                'application/json',
              )
            }
          >
            <DownloadIcon className="size-3.5" /> Config JSON
          </button>
        </div>
      </div>

      {flash && (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200"
        >
          {flash}
        </p>
      )}

      <div>
        <h3 className="mb-1.5 text-[10.5px] font-medium tracking-[0.12em] text-ink-400 uppercase">
          Preview
        </h3>
        <div className="overflow-x-auto rounded-xl border border-ink-800">
          <table className="font-mono text-[11px] whitespace-nowrap tabular-nums">
            <thead>
              <tr className="border-b border-ink-800 text-ink-400">
                {header.map((h) => (
                  <th key={h} className="px-2.5 py-1.5 text-right font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-b border-ink-800/60 text-ink-200 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2.5 py-1 text-right">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
