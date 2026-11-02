import Link from 'next/link'
import { cn } from '@/lib/storefront/cn'
import { Button } from '@/components/storefront/ui/Button'

export interface EmptyCartProps {
  className?: string
}

/** Empty drawer / page state (mockup, states grid "Empty"). */
export function EmptyCart({ className }: EmptyCartProps) {
  return (
    <div data-empty-cart="" className={cn('flex flex-col items-start gap-3 py-8', className)}>
      <p className="text-base font-semibold text-ink">Your cart is empty.</p>
      <p className="text-xs text-ink-mute">Heavyweight fleece, honest fits, small runs.</p>
      <Button asChild size="sm">
        <Link href="/collections/all">Shop new arrivals</Link>
      </Button>
      <Link
        href="/drops"
        className="text-xs text-ink-mute underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2"
      >
        See the drop
      </Link>
    </div>
  )
}
