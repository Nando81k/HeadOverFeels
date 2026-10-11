import * as React from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/storefront/cn'

export interface AccordionItemProps {
  /** Summary content — the always-visible row. */
  title: React.ReactNode
  children?: React.ReactNode
  /**
   * Exclusive-group name. Two `<details name="x">` siblings can never be open
   * at once — the browser enforces it, no JS state required. Usually inherited
   * from `<Accordion name>`.
   */
  name?: string
  /** Rendered open on first paint (server-safe: it is just the `open` attribute). */
  defaultOpen?: boolean
  className?: string
}

/** One `<details>` row. Server-safe — there is no client state anywhere here. */
export function AccordionItem({
  title,
  children,
  name,
  defaultOpen,
  className,
}: AccordionItemProps) {
  return (
    <details name={name} open={defaultOpen} className={cn('group', className)}>
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-4 py-5',
          'text-sm font-medium text-ink',
          // Safari draws its own disclosure triangle through `list-none`.
          '[&::-webkit-details-marker]:hidden'
        )}
      >
        <span className="min-w-0">{title}</span>
        <Plus
          aria-hidden="true"
          className="size-4 shrink-0 text-ink-mute transition-transform duration-sf-base ease-sf-out group-open:rotate-45"
        />
      </summary>
      <div className="pb-5 text-sm text-ink-soft">{children}</div>
    </details>
  )
}

export interface AccordionProps {
  children?: React.ReactNode
  /**
   * Applied to every `AccordionItem` that does not set its own `name`, making
   * the group single-open. Omit for a group where several rows may be open.
   */
  name?: string
  className?: string
}

/** Hairline-separated stack of `AccordionItem`s (spec §5.2). */
export function Accordion({ children, name, className }: AccordionProps) {
  const items = name
    ? React.Children.map(children, (child) =>
        React.isValidElement<AccordionItemProps>(child) &&
        child.type === AccordionItem &&
        child.props.name === undefined
          ? React.cloneElement(child, { name })
          : child
      )
    : children

  return (
    <div className={cn('divide-y divide-line border-y border-line', className)}>{items}</div>
  )
}
