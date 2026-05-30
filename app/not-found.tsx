import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F6F1EE] flex flex-col items-center justify-center px-6 text-center">
      {/* Oversized 404 as a design element */}
      <span className="text-[120px] font-black leading-none text-[#2B2B2B] opacity-[0.06] select-none mb-[-20px]">
        404
      </span>

      {/* Brand accent line */}
      <div className="w-16 h-1 bg-[#FF3131] mb-6 rounded-full" />

      <h1 className="text-4xl font-bold tracking-tight text-[#2B2B2B] mb-3 uppercase">
        Lost in the fit?
      </h1>

      <p className="text-base text-[#6B6B6B] max-w-sm mb-8 leading-relaxed">
        This page dropped out of rotation. Check the link or browse what&apos;s
        still in stock below.
      </p>

      <nav className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#2B2B2B] text-white text-sm font-semibold tracking-wide uppercase transition-all hover:bg-[#1A1A1A] hover:-translate-y-0.5 shadow-md hover:shadow-lg"
        >
          Back to home
        </Link>
        <Link
          href="/products"
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl border-2 border-[#E5DDD5] text-[#2B2B2B] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-[#F5F1EB] hover:border-[#2B2B2B]"
        >
          Shop all
        </Link>
        <Link
          href="/collections"
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl border-2 border-[#E5DDD5] text-[#2B2B2B] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-[#F5F1EB] hover:border-[#2B2B2B]"
        >
          Collections
        </Link>
      </nav>
    </div>
  );
}
