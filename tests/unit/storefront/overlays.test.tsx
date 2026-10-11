import * as React from 'react'
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Drawer } from '@/components/storefront/ui/Drawer'
import { Dialog } from '@/components/storefront/ui/Dialog'
import { Accordion, AccordionItem } from '@/components/storefront/ui/Accordion'
import { AnnouncementBar } from '@/components/storefront/ui/AnnouncementBar'
import { Marquee } from '@/components/storefront/ui/Marquee'

/**
 * jsdom 25 implements none of `HTMLDialogElement.showModal/close/show`, so the
 * overlay primitives are exercised against a minimal polyfill. The components
 * feature-detect the same methods and fall back to the `open` attribute, so
 * this only restores the parts of the contract the tests rely on.
 */
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (typeof proto.close !== 'function') {
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

afterEach(() => {
  cleanup()
  document.body.className = ''
  document.body.style.overflow = ''
  sessionStorage.clear()
})

type OverlayProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  footer?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

/** Trigger + controlled overlay, so focus return has somewhere to return to. */
function Harness({
  Overlay,
  onOpenChange,
  ...rest
}: { Overlay: React.ComponentType<OverlayProps>; onOpenChange?: (open: boolean) => void } & Omit<
  OverlayProps,
  'open' | 'onOpenChange' | 'title'
> & { title?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open overlay
      </button>
      <Overlay
        open={open}
        onOpenChange={(next) => {
          onOpenChange?.(next)
          setOpen(next)
        }}
        title="Your bag"
        {...rest}
      >
        {rest.children ?? <p>Bag contents</p>}
      </Overlay>
    </>
  )
}

function getDialog(): HTMLDialogElement {
  const dialog = document.querySelector('dialog')
  if (!dialog) throw new Error('no <dialog> rendered')
  return dialog as HTMLDialogElement
}

describe.each([
  ['Drawer', Drawer as React.ComponentType<OverlayProps>],
  ['Dialog', Dialog as React.ComponentType<OverlayProps>],
])('%s — shared modal contract', (_name, Overlay) => {
  it('renders a labelled modal dialog', async () => {
    const user = userEvent.setup()
    render(<Harness Overlay={Overlay} />)
    await user.click(screen.getByRole('button', { name: 'Open overlay' }))

    const dialog = getDialog()
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const heading = document.getElementById(labelledBy as string)
    expect(heading).not.toBeNull()
    expect(heading).toHaveTextContent('Your bag')
  })

  it('is closed (no open attribute) until asked to open', () => {
    render(<Harness Overlay={Overlay} />)
    expect(getDialog()).not.toHaveAttribute('open')
  })

  it('wires description to aria-describedby', async () => {
    const user = userEvent.setup()
    render(<Harness Overlay={Overlay} description="Items are reserved for 10 minutes." />)
    await user.click(screen.getByRole('button', { name: 'Open overlay' }))

    const describedBy = getDialog().getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'Items are reserved for 10 minutes.'
    )
  })

  it('moves focus inside the overlay when it opens', async () => {
    const user = userEvent.setup()
    render(<Harness Overlay={Overlay} />)
    await user.click(screen.getByRole('button', { name: 'Open overlay' }))

    expect(getDialog().contains(document.activeElement)).toBe(true)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn<(open: boolean) => void>()
    render(<Harness Overlay={Overlay} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Open overlay' }))
    onOpenChange.mockClear()

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(getDialog()).not.toHaveAttribute('open')
  })

  it('closes on the native cancel event', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn<(open: boolean) => void>()
    render(<Harness Overlay={Overlay} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Open overlay' }))
    onOpenChange.mockClear()

    act(() => {
      getDialog().dispatchEvent(new Event('cancel', { cancelable: true }))
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes when the backdrop (the dialog element itself) is clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn<(open: boolean) => void>()
    render(<Harness Overlay={Overlay} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Open overlay' }))
    onOpenChange.mockClear()

    await user.click(getDialog())
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(getDialog()).not.toHaveAttribute('open')
  })

  it('does not close when the panel is clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn<(open: boolean) => void>()
    render(<Harness Overlay={Overlay} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Open overlay' }))
    onOpenChange.mockClear()

    await user.click(screen.getByText('Bag contents'))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(getDialog()).toHaveAttribute('open')
  })

  it('closes from the header close button', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn<(open: boolean) => void>()
    render(<Harness Overlay={Overlay} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Open overlay' }))
    onOpenChange.mockClear()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(getDialog()).not.toHaveAttribute('open')
  })

  it('locks the body while open and unlocks it on close', async () => {
    const user = userEvent.setup()
    render(<Harness Overlay={Overlay} />)
    expect(document.body.classList.contains('overflow-hidden')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Open overlay' }))
    expect(document.body.classList.contains('overflow-hidden')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.body.classList.contains('overflow-hidden')).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('returns focus to the trigger after closing', async () => {
    const user = userEvent.setup()
    render(<Harness Overlay={Overlay} />)
    const trigger = screen.getByRole('button', { name: 'Open overlay' })

    await user.click(trigger)
    expect(document.activeElement).not.toBe(trigger)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.activeElement).toBe(trigger)
  })

  it('renders the footer slot when given', async () => {
    const user = userEvent.setup()
    render(<Harness Overlay={Overlay} footer={<button type="button">Checkout</button>} />)
    await user.click(screen.getByRole('button', { name: 'Open overlay' }))

    expect(screen.getByRole('button', { name: 'Checkout' })).toBeInTheDocument()
  })
})

describe('Drawer', () => {
  it('anchors right by default and slides in from the right', () => {
    const { container } = render(
      <Drawer open onOpenChange={() => {}} title="Cart">
        <p>Bag</p>
      </Drawer>
    )
    const dialog = container.querySelector('dialog') as HTMLDialogElement
    expect(dialog.className).toContain('justify-end')

    const panel = dialog.querySelector('[data-state]') as HTMLElement
    expect(panel.getAttribute('data-state')).toBe('open')
    expect(panel.className).toContain('data-[state=closed]:translate-x-full')
    expect(panel.className).toContain('transition-transform')
    expect(panel.className).toContain('duration-sf-slow')
    expect(panel.className).toContain('bg-paper')
  })

  it('anchors left when side="left"', () => {
    const { container } = render(
      <Drawer open side="left" onOpenChange={() => {}} title="Menu">
        <p>Menu</p>
      </Drawer>
    )
    const dialog = container.querySelector('dialog') as HTMLDialogElement
    expect(dialog.className).toContain('justify-start')
    const panel = dialog.querySelector('[data-state]') as HTMLElement
    expect(panel.className).toContain('data-[state=closed]:-translate-x-full')
  })

  it('tints the native backdrop with a token colour', () => {
    const { container } = render(
      <Drawer open onOpenChange={() => {}} title="Cart">
        <p>Bag</p>
      </Drawer>
    )
    expect((container.querySelector('dialog') as HTMLElement).className).toContain(
      'backdrop:bg-ink/40'
    )
  })
})

describe('Dialog', () => {
  it('centres the panel and defaults to the md size', () => {
    const { container } = render(
      <Dialog open onOpenChange={() => {}} title="Size guide">
        <p>Chart</p>
      </Dialog>
    )
    const dialog = container.querySelector('dialog') as HTMLDialogElement
    expect(dialog.className).toContain('items-center')
    expect(dialog.className).toContain('justify-center')

    const panel = dialog.querySelector('[data-state]') as HTMLElement
    expect(panel.className).toContain('m-auto')
    expect(panel.className).toContain('rounded-sharp')
    expect(panel.className).toContain('w-[min(100vw-2rem,32rem)]')
  })

  it('maps the size prop onto the panel width', () => {
    const { container, rerender } = render(
      <Dialog open size="sm" onOpenChange={() => {}} title="Small">
        <p>Body</p>
      </Dialog>
    )
    expect((container.querySelector('dialog > [data-state]') as HTMLElement).className).toContain(
      'w-[min(100vw-2rem,24rem)]'
    )

    rerender(
      <Dialog open size="lg" onOpenChange={() => {}} title="Large">
        <p>Body</p>
      </Dialog>
    )
    expect((container.querySelector('dialog > [data-state]') as HTMLElement).className).toContain(
      'w-[min(100vw-2rem,48rem)]'
    )
  })
})

describe('Accordion', () => {
  it('renders each item as a <details> sharing the group name', () => {
    const { container } = render(
      <Accordion name="pdp">
        <AccordionItem title="Materials">Cotton</AccordionItem>
        <AccordionItem title="Care guide">Cold wash</AccordionItem>
      </Accordion>
    )
    const items = container.querySelectorAll('details')
    expect(items).toHaveLength(2)
    items.forEach((item) => expect(item).toHaveAttribute('name', 'pdp'))
    expect(container.firstElementChild?.className).toContain('divide-line')
    expect(container.firstElementChild?.className).toContain('border-line')
  })

  it('lets an item override the group name and works without one', () => {
    const { container } = render(
      <Accordion>
        <AccordionItem title="Standalone">Body</AccordionItem>
        <AccordionItem title="Named" name="own">
          Body
        </AccordionItem>
      </Accordion>
    )
    const items = container.querySelectorAll('details')
    expect(items[0]).not.toHaveAttribute('name')
    expect(items[1]).toHaveAttribute('name', 'own')
  })

  it('opens the item marked defaultOpen and renders a borderless summary', () => {
    const { container } = render(
      <Accordion name="pdp">
        <AccordionItem title="Materials" defaultOpen>
          Cotton
        </AccordionItem>
        <AccordionItem title="Care guide">Cold wash</AccordionItem>
      </Accordion>
    )
    const items = container.querySelectorAll('details')
    expect(items[0]).toHaveAttribute('open')
    expect(items[1]).not.toHaveAttribute('open')

    const summary = items[0].querySelector('summary') as HTMLElement
    expect(summary).toHaveTextContent('Materials')
    expect(summary.className).toContain('list-none')
    expect(summary.className).toContain('cursor-pointer')
    expect(summary.querySelector('svg')).not.toBeNull()
    expect(summary.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the panel content with muted ink', () => {
    const { container } = render(
      <Accordion>
        <AccordionItem title="Materials">Cotton</AccordionItem>
      </Accordion>
    )
    const panel = container.querySelector('details > div') as HTMLElement
    expect(panel).toHaveTextContent('Cotton')
    expect(panel.className).toContain('text-ink-soft')
    expect(panel.className).toContain('pb-5')
  })
})

describe('AnnouncementBar', () => {
  it('renders its children in a labelled region', () => {
    render(<AnnouncementBar>Free shipping over $75</AnnouncementBar>)
    const region = screen.getByRole('region', { name: 'Announcement' })
    expect(region).toHaveTextContent('Free shipping over $75')
    expect(region.className).toContain('bg-ink')
    expect(region.className).toContain('text-bone')
    expect(region.className).toContain('h-9')
  })

  it('supports the signal tone', () => {
    render(<AnnouncementBar tone="signal">Drop live</AnnouncementBar>)
    const region = screen.getByRole('region', { name: 'Announcement' })
    expect(region.className).toContain('bg-signal')
    expect(region.className).toContain('text-signal-ink')
  })

  it('dismisses and persists the dismissal in sessionStorage', async () => {
    const user = userEvent.setup()
    render(<AnnouncementBar id="ship">Free shipping over $75</AnnouncementBar>)

    await user.click(screen.getByRole('button', { name: 'Dismiss announcement' }))

    expect(screen.queryByRole('region', { name: 'Announcement' })).toBeNull()
    expect(sessionStorage.getItem('hof:announcement:ship')).toBe('1')
  })

  it('uses the default storage key when no id is given', async () => {
    const user = userEvent.setup()
    render(<AnnouncementBar>Free shipping</AnnouncementBar>)
    await user.click(screen.getByRole('button', { name: 'Dismiss announcement' }))
    expect(sessionStorage.getItem('hof:announcement:announcement')).toBe('1')
  })

  it('renders nothing when the dismissal flag is already set', () => {
    sessionStorage.setItem('hof:announcement:ship', '1')
    const { container } = render(<AnnouncementBar id="ship">Free shipping</AnnouncementBar>)
    expect(container).toBeEmptyDOMElement()
  })

  it('omits the dismiss button when dismissible is false', () => {
    render(<AnnouncementBar dismissible={false}>Free shipping</AnnouncementBar>)
    expect(screen.queryByRole('button', { name: 'Dismiss announcement' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Announcement' })).toBeInTheDocument()
  })

  it('survives sessionStorage throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => render(<AnnouncementBar>Free shipping</AnnouncementBar>)).not.toThrow()
    expect(screen.getByRole('region', { name: 'Announcement' })).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('Marquee', () => {
  it('renders its children twice with the clone hidden from assistive tech', () => {
    render(<Marquee>Free shipping over $75</Marquee>)
    const copies = screen.getAllByText('Free shipping over $75')
    expect(copies).toHaveLength(2)
    expect(copies[0]).not.toHaveAttribute('aria-hidden')
    expect(copies[1].closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('animates the track and honours reduced motion', () => {
    const { container } = render(<Marquee>Drop 04</Marquee>)
    const track = container.querySelector('[data-marquee-track]') as HTMLElement
    expect(track.className).toContain('motion-safe:animate-[sf-marquee_var(--sf-marquee-duration)_linear_infinite]')
    expect(track.className).toContain('motion-reduce:animate-none')
    expect(track.style.getPropertyValue('--sf-marquee-duration')).toBe('24s')
  })

  it('maps the speed prop to the duration custom property', () => {
    const { container, rerender } = render(<Marquee speed="slow">Slow</Marquee>)
    let track = container.querySelector('[data-marquee-track]') as HTMLElement
    expect(track.style.getPropertyValue('--sf-marquee-duration')).toBe('40s')

    rerender(<Marquee speed="fast">Fast</Marquee>)
    track = container.querySelector('[data-marquee-track]') as HTMLElement
    expect(track.style.getPropertyValue('--sf-marquee-duration')).toBe('14s')
  })

  it('pauses on hover and applies the tone', () => {
    const { container } = render(<Marquee tone="signal">Drop 04</Marquee>)
    const strip = container.firstElementChild as HTMLElement
    expect(strip.className).toContain('overflow-hidden')
    expect(strip.className).toContain('bg-signal')
    expect(strip.className).toContain('text-signal-ink')
    const track = container.querySelector('[data-marquee-track]') as HTMLElement
    expect(track.className).toContain('group-hover:[animation-play-state:paused]')
  })

  it('hoists the keyframes into <head> exactly once', () => {
    render(
      <>
        <Marquee>Drop 04</Marquee>
        <Marquee>Drop 05</Marquee>
      </>
    )
    // React 19 hoists `<style href precedence>` into <head> as `data-href`.
    const styles = document.head.querySelectorAll('style[data-href="sf-marquee"]')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toContain('@keyframes sf-marquee')
  })
})
