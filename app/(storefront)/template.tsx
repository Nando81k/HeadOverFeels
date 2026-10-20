import type { ReactNode } from 'react'

/**
 * Route transition for the storefront. A `template` remounts on every
 * navigation (unlike the layout), so the incoming page runs the `sf-page-enter`
 * keyframe from motion.css: a short rise under the sticky header. Pure CSS —
 * it costs nothing without JS and collapses to nothing under
 * `prefers-reduced-motion`.
 */
export default function StorefrontTemplate({ children }: { children: ReactNode }) {
  return <div className="sf-page-enter">{children}</div>
}
