"use client";

// A horizontal rail (tabs, sub-nav) with edge arrows and a boxed background
// so side-scrolling is obvious on phones. The arrows live OUTSIDE the
// scrolling row and only render when the content actually overflows; each
// disables at its end of the rail.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

function RailArrow({
  dir,
  disabled,
  onClick,
  label,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-lg border border-edge bg-panel text-silver transition hover:border-edge-2 hover:text-chalk disabled:cursor-default disabled:opacity-30 disabled:hover:border-edge disabled:hover:text-silver"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d={dir === -1 ? "M9 2L4 7l5 5" : "M5 2l5 5-5 5"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function ScrollRail({
  children,
  className = "",
  railClassName = "",
  railProps,
}: {
  children: ReactNode;
  className?: string;
  railClassName?: string;
  /** Extra attributes for the scrolling row itself (role, aria, onKeyDown). */
  railProps?: HTMLAttributes<HTMLDivElement>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ scrollable: false, atStart: true, atEnd: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setState({
      scrollable: el.scrollWidth > el.clientWidth + 4,
      atStart: el.scrollLeft <= 2,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  // Instant, not smooth: programmatic smooth scrolls are unreliable across
  // engines (and this project has scar tissue from iOS smooth scrolling).
  const nudge = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7) });
    update();
  };

  const { onScroll: railOnScroll, className: extraRailClass = "", ...restRailProps } =
    railProps ?? {};

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {state.scrollable && (
        <RailArrow dir={-1} disabled={state.atStart} onClick={() => nudge(-1)} label="Scroll left" />
      )}
      <div
        ref={ref}
        onScroll={(e) => {
          update();
          railOnScroll?.(e);
        }}
        className={`flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl border border-edge bg-panel p-1.5 ${railClassName} ${extraRailClass}`}
        {...restRailProps}
      >
        {children}
      </div>
      {state.scrollable && (
        <RailArrow dir={1} disabled={state.atEnd} onClick={() => nudge(1)} label="Scroll right" />
      )}
    </div>
  );
}
