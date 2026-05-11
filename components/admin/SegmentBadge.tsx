/**
 * Segment Badge Component
 *
 * Renders a customer segment using the canonical admin `<StatusPill>` so
 * it matches the rest of the dashboard's dark-theme design system.
 */

import { type CustomerSegment, getSegmentInfo } from '@/lib/customer-segments'
import { StatusPill, type StatusTone } from './StatusPill'

interface SegmentBadgeProps {
  segment: CustomerSegment
  showDescription?: boolean
}

const SEGMENT_TONES: Record<CustomerSegment, StatusTone> = {
  VIP: 'violet',
  New: 'blue',
  'At-Risk': 'rose',
  Active: 'emerald',
  Inactive: 'neutral',
}

export function SegmentBadge({ segment, showDescription = false }: SegmentBadgeProps) {
  const info = getSegmentInfo(segment)
  const tone = SEGMENT_TONES[segment] ?? 'neutral'

  return (
    <div className="inline-flex items-center gap-2">
      <StatusPill tone={tone}>{info.label}</StatusPill>
      {showDescription && <span className="text-sm text-white/55">{info.description}</span>}
    </div>
  )
}
