import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vt-navy)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[var(--vt-coral)] text-white shadow hover:brightness-105 active:scale-[0.98]",
        destructive:
          "border border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20",
        outline:
          "border border-white/15 bg-transparent text-white hover:bg-white/5",
        secondary:
          "border border-white/10 bg-white/5 text-white hover:bg-white/10",
        ghost: "border border-transparent text-white/90 hover:bg-white/5",
        link: "border-0 bg-transparent text-[var(--vt-blue)] underline-offset-4 hover:underline",
        success:
          "border border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15",
        oauth:
          "border border-white bg-white text-slate-900 shadow-[0_8px_20px_-6px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[0_12px_24px_-6px_rgba(255,255,255,0.3)] active:scale-[0.98] active:translate-y-0",
        /** Primary actions using app blue (composer send, tools nav active, etc.) */
        accent:
          "border-0 bg-[var(--vt-blue)] text-white shadow-[0_4px_16px_rgba(76,110,245,0.3)] hover:brightness-110 hover:bg-[var(--vt-blue)] active:scale-[0.98] disabled:opacity-30",
      },
      size: {
        default: "h-10 rounded-lg px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-lg px-8 text-base",
        pill:
          "min-h-12 rounded-full px-4 py-3 text-sm font-bold sm:min-h-11",
        pillCompact: "rounded-full px-4 py-2.5 text-sm font-semibold",
        icon: "size-10 rounded-lg p-0",
        iconSm: "size-9 rounded-lg p-0",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        size: "pill",
        class:
          "shadow-[0_12px_24px_-6px_rgba(242,109,109,0.45)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-6px_rgba(242,109,109,0.6)] active:translate-y-0",
      },
      {
        variant: "oauth",
        size: "pill",
        class: "min-h-12 w-full overflow-hidden text-[15px] sm:min-h-11",
      },
      {
        variant: "accent",
        size: "icon",
        class:
          "mb-0.5 size-10 rounded-full border-0 shadow-[0_4px_16px_rgba(76,110,245,0.35)] sm:size-9 [&_svg]:!size-[18px]",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
