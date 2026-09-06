import * as React from 'react'
import { Slot, Slottable } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/storefront/cn'

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-sharp font-semibold uppercase tracking-[0.08em]',
    'transition-colors duration-sf-fast ease-sf-out',
    'disabled:opacity-50 disabled:pointer-events-none',
    'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
  ].join(' '),
  {
    variants: {
      variant: {
        ink: 'bg-ink text-bone hover:bg-ink-soft',
        signal: 'bg-signal text-signal-ink hover:bg-ink',
        outline: 'border border-ink bg-transparent text-ink hover:bg-ink hover:text-bone',
        ghost: 'text-ink hover:bg-rose-tint',
        link: 'text-ink underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-4 text-xs',
        md: 'h-11 px-6 text-[13px]',
        lg: 'h-12 min-h-12 px-8 text-sm',
      },
    },
    compoundVariants: [
      // `link` is inline type, not a control: no box, no hit target.
      { variant: 'link', class: 'h-auto min-h-0 p-0' },
    ],
    defaultVariants: {
      variant: 'ink',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the single child element instead of a `<button>` (Radix Slot). */
  asChild?: boolean
  /** Disables the button, sets `aria-busy` and prefixes an inline spinner. */
  loading?: boolean
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4 shrink-0 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="8" cy="8" r="6" className="opacity-25" />
      <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Storefront button (design spec §5.2).
 *
 * React 19: `ref` is an ordinary prop, so no `forwardRef` wrapper is needed.
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  type,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  const isDisabled = Boolean(disabled) || loading

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      // With `asChild` the props land on whatever the child is (usually an
      // `<a>`), which must not receive `type`/`disabled`.
      {...(asChild
        ? { 'aria-disabled': isDisabled || undefined }
        : { type: type ?? 'button', disabled: isDisabled })}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      <Slottable>{children}</Slottable>
    </Comp>
  )
}
