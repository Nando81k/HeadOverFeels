'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { MenuItem } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/**
 * Grace period before a hovered flyout closes, so a diagonal mouse path from
 * the trigger to the panel does not snap it shut mid-travel.
 */
const CLOSE_DELAY_MS = 120

/** Shared type ramp for the top row (spec §5.3). */
const TOP_LEVEL_CLASS = [
  'inline-flex h-16 items-center gap-1.5',
  'text-[13px] font-medium uppercase tracking-[0.06em]',
  'transition-colors duration-sf-fast ease-sf-out hover:text-signal',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
].join(' ')

/** The live-drop marker after the "Drops" label. */
const DROP_TITLE = /drops/i

function DropDot() {
  return (
    <span
      aria-hidden="true"
      data-drop-dot=""
      className="inline-block size-1.5 shrink-0 rounded-pill bg-signal"
    />
  )
}

export interface HeaderNavProps {
  /** Top-level Shopify menu items; one level of children is rendered as a flyout. */
  items: MenuItem[]
  className?: string
}

/**
 * Desktop primary navigation (spec §5.3).
 *
 * Items with children are disclosure buttons rather than links: the flyout is
 * the destination list, so the trigger itself has nowhere to go. It opens on
 * hover, on focus and on click, and closes on Escape, on blur out of the item
 * and `CLOSE_DELAY_MS` after the pointer leaves.
 *
 * The panel is `position: absolute` with no positioned ancestor inside this
 * component, so it anchors to the sticky `<header>` and spans its full width.
 */
export function HeaderNav({ items, className }: HeaderNavProps) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const baseId = React.useId()

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current === null) return
    clearTimeout(closeTimer.current)
    closeTimer.current = null
  }, [])

  const open = React.useCallback(
    (id: string) => {
      cancelClose()
      setOpenId(id)
    },
    [cancelClose]
  )

  const close = React.useCallback(() => {
    cancelClose()
    setOpenId(null)
  }, [cancelClose])

  const scheduleClose = React.useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      setOpenId(null)
    }, CLOSE_DELAY_MS)
  }, [cancelClose])

  React.useEffect(() => cancelClose, [cancelClose])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || openId === null) return
    event.stopPropagation()
    close()
  }

  return (
    <nav
      aria-label="Primary"
      className={cn('h-full items-center', className)}
      onKeyDown={handleKeyDown}
    >
      <ul className="flex h-full items-center gap-7">
        {items.map((item) => {
          const isDrop = DROP_TITLE.test(item.title)
          const hasChildren = item.items.length > 0

          if (!hasChildren) {
            return (
              <li key={item.id}>
                <Link href={item.url} className={TOP_LEVEL_CLASS}>
                  {item.title}
                  {isDrop ? <DropDot /> : null}
                </Link>
              </li>
            )
          }

          const panelId = `${baseId}-${item.id}`
          const isOpen = openId === item.id

          return (
            <li
              key={item.id}
              onMouseEnter={() => open(item.id)}
              onMouseLeave={scheduleClose}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close()
              }}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onFocus={() => open(item.id)}
                onClick={() => (isOpen ? close() : open(item.id))}
                className={TOP_LEVEL_CLASS}
              >
                {item.title}
                {isDrop ? <DropDot /> : null}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'size-3.5 transition-transform duration-sf-base ease-sf-out',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {isOpen ? (
                <div
                  id={panelId}
                  data-flyout=""
                  className="absolute left-0 right-0 top-full z-40 border-b border-line bg-paper text-ink shadow-sm"
                  onMouseEnter={cancelClose}
                  onMouseLeave={scheduleClose}
                >
                  <div className="mx-auto w-full max-w-shop px-gutter py-8">
                    <ul className="columns-2 gap-10 md:columns-3 [&>li]:break-inside-avoid">
                      {item.items.map((child) => (
                        <li key={child.id} className="mb-3">
                          <Link
                            href={child.url}
                            onClick={close}
                            className={cn(
                              'inline-block py-1 text-sm text-ink-soft',
                              'transition-colors duration-sf-fast ease-sf-out hover:text-signal',
                              'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
                            )}
                          >
                            {child.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
