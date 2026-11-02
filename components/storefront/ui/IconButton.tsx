import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/storefront/cn'

export const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center',
    // 44px minimum hit target (spec §5.2), square.
    'min-h-11 min-w-11 rounded-sharp',
    'transition-colors duration-sf-fast ease-sf-out',
    'disabled:opacity-50 disabled:pointer-events-none',
    'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
  ].join(' '),
  {
    variants: {
      variant: {
        ghost: 'text-ink hover:bg-rose-tint',
        ink: 'bg-ink text-bone hover:bg-ink-soft',
        outline: 'border border-ink bg-transparent text-ink hover:bg-ink hover:text-bone',
      },
    },
    defaultVariants: {
      variant: 'ghost',
    },
  }
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Required accessible name — the icon child is decorative. */
  label: string
  /** Render the single child element instead of a `<button>` (Radix Slot). */
  asChild?: boolean
  /** The icon. Give it `aria-hidden="true"`. */
  children: React.ReactNode
}

/** Square, icon-only control with a guaranteed 44px hit target. */
export function IconButton({
  className,
  variant,
  label,
  asChild = false,
  type,
  children,
  ...props
}: IconButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      aria-label={label}
      className={cn(iconButtonVariants({ variant }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    >
      {children}
    </Comp>
  )
}
