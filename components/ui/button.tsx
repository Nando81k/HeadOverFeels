import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2B2B] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 uppercase",
  {
    variants: {
      variant: {
        default: "bg-[#2B2B2B] text-white shadow-md hover:bg-[#1A1A1A] hover:shadow-lg transform hover:-translate-y-0.5",
        destructive: "bg-[#E74C3C] text-white shadow-md hover:bg-[#C0392B] hover:shadow-lg",
        outline: "border-2 border-[#E5DDD5] bg-transparent text-[#2B2B2B] hover:bg-[#F5F1EB] hover:border-[#2B2B2B]",
        secondary: "bg-[#F5F1EB] text-[#1A1A1A] shadow-sm hover:bg-[#E8DFD4]",
        ghost: "hover:bg-[#F5F1EB] text-[#2B2B2B]",
        link: "text-[#2B2B2B] underline-offset-4 hover:underline normal-case tracking-normal",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-10 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }