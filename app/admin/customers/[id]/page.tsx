/**
 * Customer Detail Page
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

// Force dynamic rendering (no prerendering during build)
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Verify customer exists (quick check)
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!customer) {
    notFound();
  }

  // Render the client component with just the ID
  // All data fetching is done client-side for interactivity
  return <CustomerDetailClient customerId={id} />;
}
