'use client';

import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';

const SCROLL_THRESHOLD = 360;
const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function BackToTop() {
  const { scrollY, scrollYProgress } = useScroll();
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 32, restDelta: 0.001 });
  const dashOffset = useTransform(progress, [0, 1], [CIRCUMFERENCE, 0]);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const next = latest > SCROLL_THRESHOLD;
    setVisible((current) => (current === next ? current : next));
  });

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label="Kembali ke atas"
          title="Kembali ke atas"
          onClick={handleClick}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 14 }}
          transition={prefersReducedMotion
            ? { duration: 0.15, ease: 'easeOut' }
            : { type: 'spring', stiffness: 520, damping: 32, mass: 0.7 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-primary shadow-lg backdrop-blur-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background min-[60rem]:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 44 44" className="pointer-events-none absolute inset-0 -rotate-90 text-border" fill="none">
            <circle cx="22" cy="22" r={RADIUS} stroke="currentColor" strokeWidth="2" opacity="0.7" />
            <motion.circle
              cx="22"
              cy="22"
              r={RADIUS}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              style={{ strokeDashoffset: dashOffset }}
              className="text-primary"
            />
          </svg>
          <ArrowUp className="relative h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
