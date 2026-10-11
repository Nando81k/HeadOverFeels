'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/storefront/cn'
import { IconButton } from './IconButton'
import { useLockBody } from './useLockBody'

export interface OverlayProps {
  /** Controlled visibility. */
  open: boolean
  /** Called with `false` on Escape, backdrop click and the close button. */
  onOpenChange: (open: boolean) => void
  /** Accessible name of the overlay; rendered in the header. */
  title: string
  /** Optional supporting copy, wired to `aria-describedby`. */
  description?: string
  children?: React.ReactNode
  /** Merged onto the panel, not the `<dialog>` element. */
  className?: string
  /** Pinned below the scrollable body (checkout button, form actions…). */
  footer?: React.ReactNode
}

export interface ModalSurfaceProps extends OverlayProps {
  /** Layout of the full-viewport `<dialog>` (which doubles as the scrim). */
  dialogClassName?: string
  /** The visible surface inside the dialog. */
  panelClassName?: string
}

/**
 * Shared native-`<dialog>` plumbing behind `Dialog` and `Drawer`.
 *
 * Exported so `Drawer` can reuse it verbatim — a drawer is this surface pinned
 * to an edge. Prefer `Dialog`/`Drawer` in application code.
 *
 * The `<dialog>` element itself is stretched over the viewport and left
 * transparent, so a click that lands on it (rather than on the panel) is
 * unambiguously a backdrop click; the tint comes from `::backdrop`.
 *
 * `showModal()`/`close()` are feature-detected: jsdom implements neither, and
 * falling back to the `open` attribute keeps the component testable.
 */
export function ModalSurface({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  footer,
  dialogClassName,
  panelClassName,
}: ModalSurfaceProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const restoreFocusRef = React.useRef<HTMLElement | null>(null)
  // True only while we are the ones calling close(), so the resulting `close`
  // event does not bounce a redundant onOpenChange(false) back to the parent.
  const selfClosingRef = React.useRef(false)

  const baseId = React.useId()
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-description`

  useLockBody(open)

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) {
        restoreFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      // Land focus on the panel rather than the first control, so screen
      // readers announce the dialog before its close button.
      panelRef.current?.focus()
      return
    }

    if (dialog.open) {
      selfClosingRef.current = true
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
      selfClosingRef.current = false
    }

    const previous = restoreFocusRef.current
    restoreFocusRef.current = null
    previous?.focus()
  }, [open])

  // Unmounting while open still owes the page its focus back.
  React.useEffect(
    () => () => {
      restoreFocusRef.current?.focus()
      restoreFocusRef.current = null
    },
    []
  )

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      if (!selfClosingRef.current) onOpenChange(false)
    }
    // Escape: stay fully controlled — veto the native close and let the parent
    // drive `open` back to false.
    const handleCancel = (event: Event) => {
      event.preventDefault()
      onOpenChange(false)
    }

    dialog.addEventListener('close', handleClose)
    dialog.addEventListener('cancel', handleCancel)
    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('cancel', handleCancel)
    }
  }, [onOpenChange])

  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onOpenChange(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    onOpenChange(false)
  }

  const state = open ? 'open' : 'closed'

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-state={state}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        // `hidden open:flex` matters: an author `display` would otherwise beat
        // the UA `dialog:not([open]) { display: none }` rule and leak the
        // overlay onto the page while closed.
        'hidden open:flex fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0',
        'backdrop:bg-ink/40',
        dialogClassName
      )}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        data-state={state}
        className={cn('focus:outline-none', panelClassName, className)}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-gutter py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-sm font-semibold uppercase tracking-eyebrow text-ink"
            >
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-xs text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close" onClick={() => onOpenChange(false)}>
            <X aria-hidden="true" className="size-5" />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-gutter py-5">{children}</div>

        {footer ? <div className="border-t border-line px-gutter py-4">{footer}</div> : null}
      </div>
    </dialog>
  )
}

export const dialogPanelVariants = cva(
  [
    'relative m-auto flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden',
    'rounded-sharp bg-paper text-ink shadow-xl',
    // Enter transition only: the dialog is display:none the moment it closes,
    // so an exit animation would need a JS-held unmount. Not worth it here.
    'transition duration-sf-base ease-sf-out',
    'starting:scale-95 starting:opacity-0 data-[state=closed]:opacity-0',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'w-[min(100vw-2rem,24rem)]',
        md: 'w-[min(100vw-2rem,32rem)]',
        lg: 'w-[min(100vw-2rem,48rem)]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

export interface DialogProps extends OverlayProps, VariantProps<typeof dialogPanelVariants> {}

/** Centred modal on a native `<dialog>` (spec §5.2). */
export function Dialog({ size, ...props }: DialogProps) {
  return (
    <ModalSurface
      {...props}
      dialogClassName="items-center justify-center p-4"
      panelClassName={dialogPanelVariants({ size })}
    />
  )
}
