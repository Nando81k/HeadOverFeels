'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { ModalSurface, type OverlayProps } from './Dialog'

export const drawerPanelVariants = cva(
  [
    'relative flex h-full w-[min(100vw,26rem)] flex-col overflow-hidden',
    'bg-paper text-ink shadow-xl',
    // Enter transition only — see the note in Dialog's panel variants.
    'translate-x-0 transition-transform duration-sf-slow ease-sf-out',
  ].join(' '),
  {
    variants: {
      side: {
        right: 'starting:translate-x-full data-[state=closed]:translate-x-full',
        left: 'starting:-translate-x-full data-[state=closed]:-translate-x-full',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  }
)

export interface DrawerProps extends OverlayProps, VariantProps<typeof drawerPanelVariants> {}

/**
 * Edge-anchored modal — the cart and the mobile menu (spec §5.2/§5.3).
 *
 * A `Drawer` is a `Dialog` pinned to one side; all of the `<dialog>` behaviour
 * (Escape, backdrop click, focus return, body lock) lives in `ModalSurface`.
 */
export function Drawer({ side, ...props }: DrawerProps) {
  return (
    <ModalSurface
      {...props}
      dialogClassName={side === 'left' ? 'justify-start' : 'justify-end'}
      panelClassName={drawerPanelVariants({ side })}
    />
  )
}
