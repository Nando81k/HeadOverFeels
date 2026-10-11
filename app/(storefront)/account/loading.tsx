import { Skeleton, SkeletonText } from '@/components/storefront/ui/Skeleton'

/**
 * Account loading UI: the overview's card grid is the honest placeholder for
 * every page under `/account` (the shell's nav is already on screen).
 */
export default function AccountLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your account" className="flex flex-col gap-8">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-sharp border border-line bg-paper p-5">
            <Skeleton className="mb-4 h-3 w-24" />
            <SkeletonText lines={3} />
          </div>
        ))}
      </div>
    </div>
  )
}
