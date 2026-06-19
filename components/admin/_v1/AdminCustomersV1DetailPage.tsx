/**
 * Customer Detail Page (V1)
 *
 * Verbatim relocation of the V1 customer detail server component. The original
 * route's `params: Promise<{ id: string }>` indirection is stripped — this
 * function takes the resolved customerId as a prop. The V1 client (936L lives
 * at components/admin/customer-detail/CustomerDetailClient.tsx) is imported
 * unchanged.
 *
 * Comprehensive view of a single customer with:
 * - Profile information with modern dark theme
 * - Customer spending and points activity charts
 * - Complete purchase history with expandable details
 * - Care Points tracking with tier progression
 * - Admin gift points functionality
 * - Internal notes management
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CustomerDetailClient } from '@/components/admin/customer-detail';

export async function AdminCustomersV1DetailPage({ customerId }: { customerId: string }) {
  // Verify customer exists (quick check)
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });

  if (!customer) {
    notFound();
  }

  // Render the client component with just the ID
  // All data fetching is done client-side for interactivity
  return <CustomerDetailClient customerId={customerId} />;
}
