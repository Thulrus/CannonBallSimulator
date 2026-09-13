/** Canvas and chart colours. Keep in sync with the @theme tokens in index.css. */
export const PALETTE = {
  brass: '#eab25a',
  brassLight: '#f5cf85',
  brassDark: '#b37a25',
  ink100: '#e6ebf3',
  ink200: '#c7cfdc',
  ink300: '#a3aec2',
  ink400: '#7a879e',
  ink500: '#56627a',
  ink600: '#334058',
  ink700: '#222c40',
  ink800: '#161e2e',
  ink900: '#0c111b',
} as const

export const FORCE_COLORS = {
  velocity: '#67e8f9',
  gravity: '#f87171',
  drag: '#fb923c',
  magnus: '#c084fc',
  coriolis: '#34d399',
  wind: '#93c5fd',
} as const

export const SERIES_COLORS = {
  primary: '#eab25a',
  secondary: '#67e8f9',
  tertiary: '#c084fc',
  quaternary: '#34d399',
  neutral: '#e6ebf3',
  vacuum: '#7a879e',
} as const

/** Pinned-shot overlay colours — chosen to stay distinct from brass (the live shot). */
export const SHOT_COLORS = [
  '#67e8f9',
  '#c084fc',
  '#34d399',
  '#f472b6',
  '#a3e635',
  '#60a5fa',
  '#fb7185',
  '#fde047',
]

export const CHART_AXIS = { stroke: PALETTE.ink400, fontSize: 10.5 }

export const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(12, 17, 27, 0.96)',
  border: `1px solid ${PALETTE.ink700}`,
  borderRadius: 8,
  fontSize: 12,
  color: PALETTE.ink100,
  padding: '6px 10px',
}
