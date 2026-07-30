/**
 * The official mark: /public/logo-wide.svg (source: Logo/Logo-Wide.svg,
 * provided by the Commissioner). Single-line wide lockup, 1035x153, built
 * for dark surfaces. Plain <img> needs the basePath prefixed by hand;
 * NEXT_PUBLIC_BASE_PATH is inlined at build time.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function LogoMark({ height, className = "" }: { height?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${BASE}/logo-wide.svg`}
      alt="The Lions Pool"
      style={height ? { height, width: "auto" } : undefined}
      className={`inline-block w-auto ${className}`}
    />
  );
}

// Header lockup: the wide wordmark is ~6.8:1, so it needs a smaller height on
// phones to leave room for the menu button next to it.
export function LogoLockup({ compact = false }: { compact?: boolean }) {
  return <LogoMark className={compact ? "h-8 sm:h-10" : "h-14 sm:h-16"} />;
}
