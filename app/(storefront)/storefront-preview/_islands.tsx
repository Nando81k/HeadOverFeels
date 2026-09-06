'use client'

import * as React from 'react'
import { Button } from '@/components/storefront/ui/Button'
import { Dialog } from '@/components/storefront/ui/Dialog'
import { Drawer } from '@/components/storefront/ui/Drawer'
import { QuantityStepper } from '@/components/storefront/ui/QuantityStepper'

/**
 * The three stateful bits of the kitchen-sink page. Everything else on
 * `/storefront-preview` renders on the server.
 */

export function PreviewStepper() {
  const [value, setValue] = React.useState(1)

  return (
    <div className="flex items-center gap-4">
      <QuantityStepper value={value} min={1} max={5} onChange={setValue} />
      <span className="num text-sm text-ink-mute">max 5</span>
    </div>
  )
}

export function PreviewDrawer() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open drawer
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side="right"
        title="Your bag"
        description="Drawer primitive — right side, native dialog."
        footer={
          <Button variant="signal" className="w-full">
            Checkout
          </Button>
        }
      >
        <p className="text-sm text-ink-soft">Cart contents land here in Phase 3.</p>
      </Drawer>
    </>
  )
}

export function PreviewDialog() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Size guide"
        description="Dialog primitive — centred, native dialog."
      >
        <p className="text-sm text-ink-soft">
          Escape, backdrop click and the close button all return focus to the trigger.
        </p>
      </Dialog>
    </>
  )
}
