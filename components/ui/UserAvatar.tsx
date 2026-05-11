'use client'

import Image from 'next/image'

interface UserAvatarProps {
  src?: string | null
  name?: string | null
  size?: number          // px — used for both width/height and the Image fill size hint
  className?: string
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Deterministic pastel background from name
function getAvatarColor(name: string | null | undefined): string {
  const palette = [
    'bg-violet-200 text-violet-800',
    'bg-rose-200 text-rose-800',
    'bg-sky-200 text-sky-800',
    'bg-amber-200 text-amber-800',
    'bg-emerald-200 text-emerald-800',
    'bg-pink-200 text-pink-800',
    'bg-indigo-200 text-indigo-800',
    'bg-teal-200 text-teal-800',
  ]
  if (!name) return palette[0]
  const code = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return palette[code % palette.length]
}

export function UserAvatar({ src, name, size = 36, className = '' }: UserAvatarProps) {
  const initials = getInitials(name)
  const colorClass = getAvatarColor(name)
  const fontSize = Math.max(10, Math.floor(size * 0.38))

  if (src) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={src}
          alt={name ?? 'User avatar'}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      </div>
    )
  }

  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-bold select-none ${colorClass} ${className}`}
      style={{ width: size, height: size, fontSize }}
      aria-label={name ?? 'User'}
    >
      {initials}
    </div>
  )
}
