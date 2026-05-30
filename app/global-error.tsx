'use client';

export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F6F1EE',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 64,
            height: 4,
            background: '#FF3131',
            borderRadius: 9999,
            marginBottom: 32,
          }}
        />
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#2B2B2B',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            margin: '0 0 12px',
          }}
        >
          Something went wrong
        </h1>
        <p style={{ color: '#6B6B6B', fontSize: 15, margin: '0 0 32px', maxWidth: 360 }}>
          A critical error occurred. Please try refreshing the page.
        </p>
        <button
          onClick={reset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 44,
            padding: '0 32px',
            borderRadius: 12,
            background: '#2B2B2B',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
