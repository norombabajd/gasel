'use client';

import { useEffect, useRef, useCallback, forwardRef } from 'react';

/**
 * A single-line-styled textarea that wraps and grows with its content (no
 * clipping). Re-fits when its width changes too, e.g. when the workspace
 * column divider is dragged.
 */
const AutoTextarea = forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}>(function AutoTextarea({ value, onChange, onKeyDown, placeholder, className }, forwardedRef) {
  const innerRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  // Re-fit when the rendered width changes (column resize, window resize).
  useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastWidth = el.offsetWidth;
    const observer = new ResizeObserver(() => {
      const width = el.offsetWidth;
      if (width !== lastWidth) {
        lastWidth = width;
        resize();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [resize]);

  return (
    <textarea
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`resize-none ${className ?? ''}`}
    />
  );
});

export default AutoTextarea;
