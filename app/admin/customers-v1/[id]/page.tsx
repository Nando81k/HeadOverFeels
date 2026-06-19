import { AdminCustomersV1DetailPage } from '@/components/admin/_v1/AdminCustomersV1DetailPage'

// Force dynamic rendering (no prerendering during build)
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  return <AdminCustomersV1DetailPage customerId={id} />
}
