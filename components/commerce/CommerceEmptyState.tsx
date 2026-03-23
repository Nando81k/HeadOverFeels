import Link from 'next/link'
import type { ComponentType } from 'react'

type EmptyAction = {
  label: string
  href: string
}

interface CommerceEmptyStateProps {
  icon: ComponentType<{ size?: number; className?: string }>
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
    <section className="rounded-2xl border border-black/10 bg-white p-6 sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-black/15 bg-black text-white">
          <Icon size={24} className="text-white" />
        </div>

        {eyebrow ? (
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">{eyebrow}</p>
        ) : null}

        <h1 className="mt-2 text-2xl font-black tracking-tight text-black sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-black/60 sm:text-base">{description}</p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={primaryAction.href}
            className="inline-flex h-11 min-w-[190px] items-center justify-center rounded-full bg-black px-6 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black/85"
          >
            {primaryAction.label}
          </Link>

          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className="inline-flex h-11 min-w-[190px] items-center justify-center rounded-full border border-black/20 bg-white px-6 text-sm font-semibold uppercase tracking-[0.12em] text-black/75 transition-colors hover:border-black/35 hover:text-black"
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
