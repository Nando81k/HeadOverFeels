'use client';

import { motion, useScroll, useTransform, useSpring, useInView, MotionValue } from 'framer-motion';
import { useRef, ReactNode } from 'react';

// 1. PARALLAX SCROLLING - Background moves slower than foreground
interface ParallaxSectionProps {
  children: ReactNode;
  speed?: number; // 0.5 = half speed, 1 = normal speed
  className?: string;
}

export function ParallaxSection({ children, speed = 0.5, className = '' }: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${(1 - speed) * 100}%`]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}

// 2. SCROLL-TRIGGERED REVEAL - Elements animate as they enter viewport
interface ScrollRevealProps {
  children: ReactNode;
  variant?: 'fade' | 'slideUp' | 'slideLeft' | 'slideRight' | 'scale' | 'blur';
  delay?: number;
  duration?: number;
  className?: string;
}

export function ScrollReveal({ 
  children, 
  variant = 'fade', 
  delay = 0, 
  duration = 0.8,
  className = '' 
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const variants = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 }
    },
    slideUp: {
      hidden: { opacity: 0, y: 60 },
      visible: { opacity: 1, y: 0 }
    },
    slideLeft: {
      hidden: { opacity: 0, x: 60 },
      visible: { opacity: 1, x: 0 }
    },
    slideRight: {
      hidden: { opacity: 0, x: -60 },
      visible: { opacity: 1, x: 0 }
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1 }
    },
    blur: {
      hidden: { opacity: 0, filter: 'blur(10px)' },
      visible: { opacity: 1, filter: 'blur(0px)' }
    }
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants[variant]}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 3. PINNED SECTION - Content stays fixed while scrolling
interface PinnedSectionProps {
  children: ReactNode | ((scrollYProgress: MotionValue<number>) => ReactNode);
  height?: string; // Total scroll height (e.g., '200vh')
  className?: string;
}

export function PinnedSection({ children, height = '200vh', className = '' }: PinnedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end']
  });

  return (
    <div ref={ref} style={{ height }} className={`relative ${className}`}>
      <div className="sticky top-0 h-screen flex items-center justify-center">
        {typeof children === 'function' ? children(scrollYProgress) : children}
      </div>
    </div>
  );
}

// 4. HORIZONTAL SCROLL ON VERTICAL SCROLL
interface HorizontalScrollProps {
  children: ReactNode;
  className?: string;
}

export function HorizontalScroll({ children, className = '' }: HorizontalScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-50%']);
  const smoothX = useSpring(x, { stiffness: 100, damping: 30 });

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div 
        style={{ x: smoothX }}
        className="flex gap-6"
      >
        {children}
      </motion.div>
    </div>
  );
}

// 5. SMOOTH SCROLL PROGRESS INDICATOR
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-[#FF3131] origin-left z-50"
      style={{ scaleX }}
    />
  );
}

// 6. FADE ON SCROLL - Opacity changes based on scroll position
interface FadeOnScrollProps {
  children: ReactNode;
  fadeOut?: boolean; // true = fade out on scroll, false = fade in on scroll
  className?: string;
}

export function FadeOnScroll({ children, fadeOut = true, className = '' }: FadeOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start']
  });

  const opacity = useTransform(
    scrollYProgress,
    [0, 1],
    fadeOut ? [1, 0] : [0, 1]
  );

  return (
    <motion.div ref={ref} style={{ opacity }} className={className}>
      {children}
    </motion.div>
  );
}

// 7. SCALE ON SCROLL - Element scales based on scroll
interface ScaleOnScrollProps {
  children: ReactNode;
  scaleRange?: [number, number]; // [start, end] e.g., [0.8, 1]
  className?: string;
}

export function ScaleOnScroll({ 
  children, 
  scaleRange = [0.8, 1], 
  className = '' 
}: ScaleOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [scaleRange[0], scaleRange[1], scaleRange[0]]);
  const smoothScale = useSpring(scale, { stiffness: 100, damping: 30 });

  return (
    <motion.div ref={ref} style={{ scale: smoothScale }} className={className}>
      {children}
    </motion.div>
  );
}

// 8. STAGGER CHILDREN ON SCROLL - Children animate sequentially
interface StaggerScrollChildrenProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

export function StaggerScrollChildren({ 
  children, 
  staggerDelay = 0.1, 
  className = '' 
}: StaggerScrollChildrenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay
          }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerScrollItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 40 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.6,
            ease: [0.25, 0.1, 0.25, 1]
          }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 9. ROTATE ON SCROLL - Element rotates based on scroll
interface RotateOnScrollProps {
  children: ReactNode;
  rotateRange?: [number, number]; // [start, end] in degrees
  className?: string;
}

export function RotateOnScroll({ 
  children, 
  rotateRange = [0, 360], 
  className = '' 
}: RotateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const rotate = useTransform(scrollYProgress, [0, 1], rotateRange);
  const smoothRotate = useSpring(rotate, { stiffness: 100, damping: 30 });

  return (
    <motion.div ref={ref} style={{ rotate: smoothRotate }} className={className}>
      {children}
    </motion.div>
  );
}

// 10. TEXT REVEAL ON SCROLL - Text reveals word by word or letter by letter
interface TextRevealProps {
  text: string;
  className?: string;
  mode?: 'word' | 'letter';
}

export function TextReveal({ text, className = '', mode = 'word' }: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const items = mode === 'word' ? text.split(' ') : text.split('');

  return (
    <div ref={ref} className={className}>
      {items.map((item, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{
            duration: 0.5,
            delay: index * 0.05,
            ease: [0.25, 0.1, 0.25, 1]
          }}
          className="inline-block"
        >
          {item}
          {mode === 'word' && index < items.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </div>
  );
}
