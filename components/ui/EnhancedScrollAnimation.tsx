'use client';

import { motion, useScroll, useTransform, useSpring, Variants } from 'framer-motion';
import { ReactNode, useRef } from 'react';

interface EnhancedScrollAnimationProps {
  children: ReactNode;
  variant?: 'fadeUp' | 'fadeDown' | 'fadeLeft' | 'fadeRight' | 'scale' | 'rotateIn' | 'slideInBounce';
  delay?: number;
  duration?: number;
  className?: string;
}

export function EnhancedScrollAnimation({ 
  children, 
  variant = 'fadeUp',
  delay = 0, 
  duration = 0.8,
  className = '' 
}: EnhancedScrollAnimationProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Different animation variants
  const variants: Record<string, Variants> = {
    fadeUp: {
      hidden: { opacity: 0, y: 60 },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: {
          duration,
          delay,
          ease: [0.22, 1, 0.36, 1] as const
        }
      }
    },
    fadeDown: {
      hidden: { opacity: 0, y: -60 },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: {
          duration,
          delay,
          ease: [0.22, 1, 0.36, 1] as const
        }
      }
    },
    fadeLeft: {
      hidden: { opacity: 0, x: 60 },
      visible: { 
        opacity: 1, 
        x: 0,
        transition: {
          duration,
          delay,
          ease: [0.22, 1, 0.36, 1] as const
        }
      }
    },
    fadeRight: {
      hidden: { opacity: 0, x: -60 },
      visible: { 
        opacity: 1, 
        x: 0,
        transition: {
          duration,
          delay,
          ease: [0.22, 1, 0.36, 1] as const
        }
      }
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { 
        opacity: 1, 
        scale: 1,
        transition: {
          duration,
          delay,
          ease: [0.22, 1, 0.36, 1] as const
        }
      }
    },
    rotateIn: {
      hidden: { opacity: 0, rotate: -10, scale: 0.9 },
      visible: { 
        opacity: 1, 
        rotate: 0,
        scale: 1,
        transition: {
          duration,
          delay,
          ease: [0.22, 1, 0.36, 1] as const
        }
      }
    },
    slideInBounce: {
      hidden: { opacity: 0, y: 80, scale: 0.95 },
      visible: { 
        opacity: 1, 
        y: 0,
        scale: 1,
        transition: {
          duration,
          delay,
          ease: [0.34, 1.56, 0.64, 1] as const // Bounce easing
        }
      }
    }
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={variants[variant]}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Parallax scroll component
export function ParallaxScroll({ 
  children, 
  speed = 0.5,
  className = '' 
}: { 
  children: ReactNode; 
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100]);
  const springY = useSpring(y, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      ref={ref}
      style={{ y: springY }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger children animation
export function StaggerChildren({ 
  children, 
  staggerDelay = 0.1,
  className = '' 
}: { 
  children: ReactNode; 
  staggerDelay?: number;
  className?: string;
}) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.2
      }
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Individual stagger item
export function StaggerItem({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1] as const
      }
    }
  };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

