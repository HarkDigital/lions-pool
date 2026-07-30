/**
 * The Lions Pool mark: a Honolulu-blue football with silver laces, tilted
 * like it's teed up, with the wordmark alongside. Pure SVG so it scales
 * anywhere (nav, hero, favicon export).
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="rotate(-28 32 32)">
        <ellipse cx="32" cy="32" rx="26" ry="16.5" fill="#0076b6" />
        <ellipse cx="32" cy="32" rx="26" ry="16.5" stroke="#0e4f74" strokeWidth="2" />
        {/* seams */}
        <path d="M10.5 27.5c6-3.8 37-3.8 43 0" stroke="#0b5c88" strokeWidth="1.6" fill="none" opacity="0.9" />
        <path d="M10.5 36.5c6 3.8 37 3.8 43 0" stroke="#0b5c88" strokeWidth="1.6" fill="none" opacity="0.9" />
        {/* laces */}
        <path d="M20 32h24" stroke="#eef2f5" strokeWidth="2.6" strokeLinecap="round" />
        {[23, 27.4, 31.8, 36.2, 40.6].map((x) => (
          <path key={x} d={`M${x} 28.6v6.8`} stroke="#eef2f5" strokeWidth="2.2" strokeLinecap="round" />
        ))}
      </g>
    </svg>
  );
}

export function LogoLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={compact ? 30 : 40} />
      <span className="leading-none">
        <span
          className={`display block ${compact ? "text-2xl" : "text-3xl"} tracking-wide text-chalk`}
        >
          The Lions <span className="text-sky">Pool</span>
        </span>
        {!compact && (
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.34em] text-fog">
            Team · Win · Score
          </span>
        )}
      </span>
    </span>
  );
}
