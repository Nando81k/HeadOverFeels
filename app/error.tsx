'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the console for visibility (non-Sentry)
    console.error('[error boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F6F1EE] flex flex-col items-center justify-center px-6 text-center">
      {/* Brand accent line */}
      <div className="w-16 h-1 bg-[#FF3131] mb-8 rounded-full" />

      <h1 className="text-4xl font-bold tracking-tight text-[#2B2B2B] mb-3 uppercase">
        Something went wrong
      </h1>

      <p className="text-base text-[#6B6B6B] max-w-sm mb-2 leading-relaxed">
        We hit a snag on our end. It&apos;s not you — give it another shot or
        head back home.
      </p>

      {/* Support digest — never exposes raw stack trace in production */}
      {error.digest && (
        <p className="text-xs text-[#9B9B9B] mb-2">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}

      {/* Dev-only: show raw message for easier debugging */}
      {process.env.NODE_ENV === 'development' && error.message && (
        <pre className="text-xs text-left bg-[#2B2B2B] text-[#F5F1EB] rounded-lg p-4 mb-6 max-w-md w-full overflow-x-auto whitespace-pre-wrap break-words">
          {error.message}
        </pre>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Button onClick={reset} size="lg">
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
