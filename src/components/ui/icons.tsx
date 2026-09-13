/* Icon factories return components; they are stable module-level constants, so fast refresh is unaffected. */
/* eslint-disable react/only-export-components */
import type { ReactNode } from 'react'

interface IconProps {
  className?: string
}

const stroked = (children: ReactNode) =>
  function Icon({ className = 'size-4' }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {children}
      </svg>
    )
  }

const filled = (children: ReactNode) =>
  function Icon({ className = 'size-4' }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
        {children}
      </svg>
    )
  }

export const ChevronDown = stroked(<path d="m6 9 6 6 6-6" />)
export const PlayIcon = filled(
  <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />,
)
export const PauseIcon = filled(
  <>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </>,
)
export const RestartIcon = stroked(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </>,
)
export const FlameIcon = stroked(
  <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.6 2.3-4.8.3 1.6 1.2 2.6 2.2 2.8C11 9 10.8 6 12 3Z" />,
)
export const PinIcon = stroked(
  <>
    <path d="M12 17v5" />
    <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
  </>,
)
export const DownloadIcon = stroked(
  <>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </>,
)
export const LinkIcon = stroked(
  <>
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
  </>,
)
export const CopyIcon = stroked(
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </>,
)
export const EyeIcon = stroked(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
)
export const EyeOffIcon = stroked(
  <>
    <path d="M10.7 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="m2 2 20 20" />
  </>,
)
export const TrashIcon = stroked(
  <>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
  </>,
)
export const UploadIcon = stroked(
  <>
    <path d="M12 15V3" />
    <path d="m7 8 5-5 5 5" />
    <path d="M5 21h14" />
  </>,
)
export const ResetIcon = stroked(
  <>
    <path d="M4 4v6h6" />
    <path d="M20 12A8 8 0 0 0 5.3 7.6L4 10" />
    <path d="M4 12a8 8 0 0 0 14.7 4.4" />
  </>,
)
export const CannonIcon = stroked(
  <>
    <circle cx="8" cy="16" r="3.5" />
    <path d="m9.5 12.5 10-6 1.5 2.6-9.6 6.2" />
    <path d="M2 20h12" />
  </>,
)
export const BallIcon = stroked(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M8.5 9a4 4 0 0 1 3-2" />
  </>,
)
export const PowderIcon = stroked(
  <path d="M9 3h6l-1 3.5 3.5 3.5V19a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-9L10 6.5 9 3Z" />,
)
export const CloudIcon = stroked(
  <>
    <path d="M3 8h10a3 3 0 1 0-3-3" />
    <path d="M3 12h15a3 3 0 1 1-3 3" />
    <path d="M3 16h6" />
  </>,
)
export const BoltIcon = stroked(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />)
export const SlidersIcon = stroked(
  <>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </>,
)
export const KeyboardIcon = stroked(
  <>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
  </>,
)
