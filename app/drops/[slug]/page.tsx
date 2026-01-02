import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Navigation } from '@/components/layout/Navigation';
import ExclusiveDropPage from '@/components/drops/ExclusiveDropPage';

interface PageProps {
  params: {
    slug: string;
  };
}

async function getDropProduct(slug: string) {
  const product = await prisma.product.findUnique({
    where: { 
      slug,
      isLimitedEdition: true,
    },
    include: {
      variants: true,
      collections: true,
    },
  });

  if (!product) return null;

  return {
    ...product,
    images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
    description: product.description || '',
  };
}

export default async function DropPage({ params }: PageProps) {
  const product = await getDropProduct(params.slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Navigation />
      <ExclusiveDropPage product={product} />
    </div>
  );
}
