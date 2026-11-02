import { Section } from '@/components/storefront/ui/Section'
import { Skeleton, SkeletonText } from '@/components/storefront/ui/Skeleton'

/** The hub's shape while the session and ledger load: ink hero, then a 4-up grid. */
export default function LoyaltyLoading() {
  return (
    <div aria-busy="true" aria-label="Loading Care Points">
      <Section tone="ink">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-3 w-24 bg-bone/20" />
            <Skeleton className="h-28 w-64 bg-bone/20" />
            <SkeletonText lines={2} className="max-w-md [&>div]:bg-bone/20" />
          </div>
          <Skeleton className="h-56 w-full bg-bone/20" />
        </div>
      </Section>
      <Section>
        <Skeleton className="mb-8 h-10 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-56 w-full" />
          ))}
        </div>
      </Section>
    </div>
  )
}
