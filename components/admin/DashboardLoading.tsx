'use client'

import { StatsGridSkeleton, DashboardCardSkeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Quick Stats Grid */}
      <StatsGridSkeleton count={4} />

      {/* Performance Overview */}
      <div>
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <DashboardCardSkeleton />
      </div>

      {/* Sales Performance - Two Cards Side by Side */}
      <div className="grid lg:grid-cols-2 gap-6">
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
      </div>

      {/* Recent Orders */}
      <DashboardCardSkeleton />

      {/* Quick Access Links */}
      <div>
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
