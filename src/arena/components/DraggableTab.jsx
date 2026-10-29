import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';

const STORAGE_KEY = 'arena_challenge_tab_top';
const DEFAULT_TOP = 135; // Default safe position near header, avoiding podium collision
const MIN_TOP = 68; // Below sticky navbar
const BOTTOM_MARGIN = 60; // Above bottom edge

/**
 * DraggableTab is an edge-docked tab button that can be dragged vertically
 * anywhere along the screen edge so presenters can manipulate its position
 * and prevent it from overlapping leaderboard content or podium elements.
 *
 * Uses Pointer Events & Pointer Capture for flawless mouse + touch dragging.
 * Persists the user's preferred position to localStorage.
 *
 * @param {object} props
 * @param {() => void} props.onClick - Triggered only on tap/click (not on drag release)
 * @param {string} [props.label='Challenges']
 */
export function DraggableTab({ onClick, label = 'Challenges' }) {
  // Initialize position from localStorage or default safe position
  const [top, setTop] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= MIN_TOP) return val;
      }
    } catch {
      // Fallback if localStorage is restricted
    }
    return DEFAULT_TOP;
  });

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const startYRef = useRef(0);
  const startTopRef = useRef(top);
  const currentTopRef = useRef(top);

  useEffect(() => {
    currentTopRef.current = top;
  }, [top]);

  // Clamp helper within viewport
  const clampTop = useCallback((val) => {
    const maxTop = Math.max(MIN_TOP, window.innerHeight - BOTTOM_MARGIN);
    return Math.max(MIN_TOP, Math.min(val, maxTop));
  }, []);

  // Viewport resize clamping
  useEffect(() => {
    function handleResize() {
      setTop((prev) => clampTop(prev));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampTop]);

  // Pointer event handlers with pointer capture
  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback if pointer capture unsupported
    }

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startYRef.current = e.clientY;
    startTopRef.current = currentTopRef.current;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    if (Math.abs(deltaY) > 3) {
      hasMovedRef.current = true;
    }
    const newTop = clampTop(startTopRef.current + deltaY);
    currentTopRef.current = newTop;
    setTop(newTop);
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    isDraggingRef.current = false;
    setIsDragging(false);

    // Persist final position
    try {
      localStorage.setItem(STORAGE_KEY, String(currentTopRef.current));
    } catch {
      // Ignore
    }

    setTimeout(() => {
      hasMovedRef.current = false;
    }, 100);
  };

  const handleClick = (e) => {
    // If user dragged, do not trigger drawer open!
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label="Open Challenges Drawer (Draggable tab)"
      style={{
        top: `${top}px`,
        touchAction: 'none',
      }}
      className={cn(
        'fixed left-0 z-40',
        'bg-[#FBBC05] text-black border-y-[2.5px] border-r-[2.5px] border-black rounded-r-2xl',
        'shadow-[3px_3px_0_0_#000] hover:shadow-[5px_5px_0_0_#000]',
        'transition-[box-shadow,background-color] select-none cursor-grab active:cursor-grabbing group',
        'px-2 py-3 sm:px-2.5 sm:py-3.5 flex flex-col items-center gap-1.5',
        isDragging && 'shadow-[6px_6px_0_0_#000] scale-105 bg-[#E5A800]'
      )}
      title="Drag up/down along screen edge to reposition • Click to switch challenge"
    >
      {/* Visual Grip Handle Dots */}
      <span
        className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
        title="Grip Handle"
      >
        <span className="w-1 h-1 rounded-full bg-black" />
        <span className="w-1 h-1 rounded-full bg-black" />
        <span className="w-1 h-1 rounded-full bg-black" />
      </span>

      {/* Vertical Text */}
      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 text-black pointer-events-none">
        {label}
      </span>

      {/* Direction Chevron Arrow */}
      <svg
        className="w-3.5 h-3.5 text-black group-hover:translate-x-0.5 transition-transform pointer-events-none"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
