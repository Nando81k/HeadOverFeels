import { prisma } from '@/lib/prisma';

export interface ActiveDrop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  releaseDate: Date | null;
  dropEndDate: Date | null;
  maxQuantity: number | null;
  variants: Array<{
    inventory: number;
  }>;
}

/**
 * Get the currently active or upcoming limited edition drop
 * Priority: Live drops > Upcoming drops (soonest first)
 */
export async function getActiveDrop(): Promise<ActiveDrop | null> {
  const now = new Date();

  // First, try to get a live drop
  const liveDrop = await prisma.product.findFirst({
    where: {
      isLimitedEdition: true,
      isActive: true,
      releaseDate: {
        lte: now,
      },
      dropEndDate: {
        gte: now,
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      compareAtPrice: true,
      images: true,
      releaseDate: true,
      dropEndDate: true,
      maxQuantity: true,
      variants: {
        select: {
          inventory: true,
        },
      },
    },
    orderBy: {
      dropEndDate: 'asc', // Show the one ending soonest
    },
  });

  if (liveDrop) {
    return {
      ...liveDrop,
      images: JSON.parse(liveDrop.images as string) as string[],
    };
  }

  // If no live drop, get the next upcoming drop
  const upcomingDrop = await prisma.product.findFirst({
    where: {
      isLimitedEdition: true,
      isActive: true,
      releaseDate: {
        gt: now,
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      compareAtPrice: true,
      images: true,
      releaseDate: true,
      dropEndDate: true,
      maxQuantity: true,
      variants: {
        select: {
          inventory: true,
        },
      },
    },
    orderBy: {
      releaseDate: 'asc', // Show the one starting soonest
    },
  });

  if (upcomingDrop) {
    return {
      ...upcomingDrop,
      images: JSON.parse(upcomingDrop.images as string) as string[],
    };
  }

  return null;
}

/**
 * Get notification count for a product
 */
export async function getDropNotificationCount(productId: string) {
  return await prisma.dropNotification.count({
    where: { productId },
  });
}

/**
 * Get the status of a drop (past, live, or upcoming)
 */
export function getDropStatus(drop: ActiveDrop): 'past' | 'live' | 'upcoming' {
  if (!drop.releaseDate || !drop.dropEndDate) {
    return 'upcoming';
  }

  const now = new Date();
  const releaseDate = new Date(drop.releaseDate);
  const dropEndDate = new Date(drop.dropEndDate);

  if (now < releaseDate) {
    return 'upcoming';
  } else if (now >= releaseDate && now <= dropEndDate) {
    return 'live';
  } else {
    return 'past';
  }
}
