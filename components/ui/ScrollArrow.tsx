'use client';

interface ScrollArrowProps {
  targetId: string;
}

export function ScrollArrow({ targetId }: ScrollArrowProps) {
  const handleClick = () => {
    const nextSection = document.querySelector(`#${targetId}`);
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 group cursor-pointer animate-bounce"
      aria-label="Scroll to next section"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-white/70 text-sm uppercase tracking-wider group-hover:text-white transition-colors">
          Scroll
        </span>
        <svg
          className="w-6 h-6 text-white/70 group-hover:text-white transition-colors"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </div>
    </button>
  );
}
