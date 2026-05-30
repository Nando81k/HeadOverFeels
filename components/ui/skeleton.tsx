import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/[0.06]",
        className
      )}
    />
  )
}

// Stat Card Skeleton
export function StatCardSkeleton() {
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-6">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-40" />
    </div>
  )
}

// Dashboard Card Skeleton
export function DashboardCardSkeleton() {
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  )
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

// Table Skeleton
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
      {/* Table Header */}
      <div className="border-b border-white/10 bg-white/[0.03] p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      
      {/* Table Rows */}
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, j) => (
                <Skeleton key={j} className="h-4 flex-1" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Product Card Skeleton
export function ProductCardSkeleton() {
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}

// Product Grid Skeleton
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Stats Grid Skeleton
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Chart Skeleton
export function ChartSkeleton() {
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function HeroMetricSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] p-5 bg-[var(--color-surface-elevated)] flex items-center gap-6">
      <div className="flex-1 min-w-0">
        <Skeleton className="h-2.5 w-24 mb-2" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-2.5 w-40" />
      </div>
      <div className="flex-[1.2] hidden sm:block">
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  )
}

export function NeedsAttentionCardSkeleton() {
  return (
    <div className="rounded-md p-2.5 bg-white/[0.03] border border-white/8 flex items-center gap-2">
      <Skeleton className="w-6 h-6 rounded flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-2.5 w-3/4 mb-1" />
        <Skeleton className="h-2 w-1/2" />
      </div>
    </div>
  )
}

export function ActivityFeedItemSkeleton() {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Skeleton className="w-1.5 h-1.5 rounded-full" />
      <Skeleton className="h-2.5 w-1/3" />
      <Skeleton className="h-2.5 w-1/3" />
      <Skeleton className="h-2.5 w-12 ml-auto" />
    </div>
  )
}
