import Link from 'next/link'
import type { ComponentType } from 'react'
import type { Icon } from '@phosphor-icons/react'

type EmptyAction = {
  label: string
  href: string
}

interface CommerceEmptyStateProps {
  icon: Icon
  eyebrow?: string
  title: string
  description: string
  primaryAction: EmptyAction
  secondaryAction?: EmptyAction
}

export function CommerceEmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
}: CommerceEmptyStateProps) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white px-6 py-14 sm:py-20">
      <div className="mx-auto max-w-sm text-center">
        {/* Icon with layered rings for depth */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-black/6" />
          <div className="absolute inset-2 rounded-full border border-black/8 bg-black/3" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black">
            <Icon size={20} className="text-white" />
          </div>
        </div>

        {eyebrow && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">{eyebrow}</p>
        )}

        <h2 className="text-2xl font-black tracking-tight text-black sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-black/55">{description}</p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href={primaryAction.href}
            className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-full bg-black px-6 text-xs font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-black/85 active:scale-[0.97]"
          >
            {primaryAction.label}
          </Link>

          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-full border border-black/20 bg-white px-6 text-xs font-black uppercase tracking-[0.12em] text-black/70 transition-colors hover:border-black/40 hover:text-black active:scale-[0.97]"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
