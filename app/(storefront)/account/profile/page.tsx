import type { Metadata } from 'next'
import { renderAccountPage } from '@/components/storefront/account/AccountShell'
import { ProfileForm } from '@/components/storefront/account/ProfileForm'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { getCustomerSummary } from '@/lib/shopify/customer/queries'

/** `/account/profile` (Phase 4 plan, Task 5; mockup 06): name form, read-only email. */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Profile',
  robots: { index: false, follow: false },
}

const PATH = '/account/profile'

export default async function ProfileRoute() {
  return renderAccountPage(PATH, async (session) => {
    const customer = await getCustomerSummary(session.tokens.accessToken)
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Eyebrow>Account</Eyebrow>
          <Display as="h1" size="md">
            Profile
          </Display>
        </header>
        <ProfileForm customer={customer} />
      </div>
    )
  })
}
