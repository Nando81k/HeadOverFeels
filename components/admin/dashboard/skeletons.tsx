// components/admin/dashboard/skeletons.tsx
import {
  Skeleton,
  StatCardSkeleton,
  ActivityFeedItemSkeleton,
  NeedsAttentionCardSkeleton,
} from '@/components/ui/skeleton'

export function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}

export function LiveActivityFeedSkeleton() {
  return (
    <div className="rounded-[10px] bg-white/[0.025] border border-white/6 p-3">
      <Skeleton className="h-2.5 w-24 mb-3" />
      <div className="flex flex-col gap-1">
        <ActivityFeedItemSkeleton />
        <ActivityFeedItemSkeleton />
        <ActivityFeedItemSkeleton />
        <ActivityFeedItemSkeleton />
        <ActivityFeedItemSkeleton />
      </div>
    </div>
  )
}

export function SalesGoalsSkeleton() {
  return (
    <div className="rounded-[10px] bg-white/[0.025] border border-white/6 p-3">
      <Skeleton className="h-2.5 w-20 mb-3" />
      <div className="space-y-3">
        <div>
          <Skeleton className="h-2.5 w-full mb-1" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <div>
          <Skeleton className="h-2.5 w-full mb-1" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function NeedsAttentionSkeleton() {
  return (
    <div className="rounded-[10px] bg-white/[0.025] border border-white/6 p-3">
      <Skeleton className="h-2.5 w-24 mb-3" />
      <div className="flex flex-col gap-1.5">
        <NeedsAttentionCardSkeleton />
        <NeedsAttentionCardSkeleton />
        <NeedsAttentionCardSkeleton />
        <NeedsAttentionCardSkeleton />
        <NeedsAttentionCardSkeleton />
      </div>
    </div>
  )
}
