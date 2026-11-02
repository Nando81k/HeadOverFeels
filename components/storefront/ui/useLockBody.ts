'use client'

import * as React from 'react'

/** Utility class Tailwind already generates; nothing storefront-specific. */
const LOCK_CLASS = 'overflow-hidden'

/*
 * Overlays can stack (cart drawer over a size-guide dialog), so the lock is
 * reference-counted at module scope: the last overlay to unlock is the one that
 * restores the document. Without this, closing the inner overlay would unlock
 * the body while the outer one is still open.
 */
let lockCount = 0
let previousInlineOverflow = ''
let hadLockClass = false

/**
 * Freeze background scrolling while `locked` is true.
 *
 * Adds `overflow-hidden` to `<body>` (and mirrors it as an inline style so the
 * lock holds even where the Tailwind utility is not in the emitted CSS), and
 * restores the previous overflow on cleanup.
 */
export function useLockBody(locked: boolean): void {
  React.useEffect(() => {
    if (!locked) return

    const body = document.body
    if (lockCount === 0) {
      previousInlineOverflow = body.style.overflow
      hadLockClass = body.classList.contains(LOCK_CLASS)
      body.classList.add(LOCK_CLASS)
      body.style.overflow = 'hidden'
    }
    lockCount += 1

    return () => {
      lockCount -= 1
      if (lockCount > 0) return
      if (!hadLockClass) body.classList.remove(LOCK_CLASS)
      body.style.overflow = previousInlineOverflow
      previousInlineOverflow = ''
      hadLockClass = false
    }
  }, [locked])
}
