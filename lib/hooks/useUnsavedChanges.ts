'use client'

import { useCallback, useEffect } from 'react'

interface UseUnsavedChangesOptions {
  /** When true, the hook arms its guards. Set to your form's "dirty" boolean. */
  enabled: boolean
  /** Confirmation message shown by `confirmDiscard()`. */
  message?: string
}

interface UseUnsavedChangesResult {
  /**
   * Call before performing a soft (in-app) navigation like
   * `router.push(...)` or programmatically opening a destructive action.
   * Returns true when the user OK'd discarding changes (or no changes existed).
   *
   * Next.js App Router does not expose `routeChangeStart` events, so this
   * has to be invoked explicitly by the caller. The browser-level
   * `beforeunload` guard (tab close / refresh / external nav) is automatic.
   */
  confirmDiscard: () => boolean
}

const DEFAULT_MESSAGE = 'You have unsaved changes. Discard them?'

/**
 * Guards against losing unsaved form state.
 *
 * - Adds a `beforeunload` listener while `enabled` is true so browsers
 *   prompt on tab close / refresh / external link navigation.
 * - Returns `confirmDiscard()` for callers to gate soft (Next.js router)
 *   navigations or destructive actions on dirty state.
 *
 * Usage:
 * ```tsx
 * const { confirmDiscard } = useUnsavedChanges({ enabled: isDirty })
 *
 * function handleBack() {
 *   if (confirmDiscard()) router.push('/admin/products')
 * }
 * ```
 */
export function useUnsavedChanges({
  enabled,
  message = DEFAULT_MESSAGE,
}: UseUnsavedChangesOptions): UseUnsavedChangesResult {
  // Browser-level guard for hard navigations
  useEffect(() => {
    if (!enabled) return

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Modern browsers ignore the custom message and show their own; the
      // assignment is required for the prompt to fire in some browsers.
      event.returnValue = message
      return message
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [enabled, message])

  const confirmDiscard = useCallback(() => {
    if (!enabled) return true
    if (typeof window === 'undefined') return true
    return window.confirm(message)
  }, [enabled, message])

  return { confirmDiscard }
}
