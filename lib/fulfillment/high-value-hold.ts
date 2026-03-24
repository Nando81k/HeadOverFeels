export const HIGH_VALUE_HOLD_THRESHOLD = 500
export const HIGH_VALUE_HOLD_REVIEW_MARKER = '[HOLD_REVIEWED]'

export function hasReviewedHighValueHold(notes: string | null | undefined): boolean {
  if (typeof notes !== 'string') {
    return false
  }
  return notes.toUpperCase().includes(HIGH_VALUE_HOLD_REVIEW_MARKER)
}

export function appendHighValueHoldReviewMarker(
  notes: string | null | undefined,
  now: Date = new Date()
): string {
  const base = typeof notes === 'string' ? notes.trim() : ''
  if (hasReviewedHighValueHold(base)) {
    return base
  }

  const markerLine = `${HIGH_VALUE_HOLD_REVIEW_MARKER} ${now.toISOString()}`
  return base.length > 0 ? `${base}\n${markerLine}` : markerLine
}
