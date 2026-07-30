/**
 * The official mark: /public/logo-wide.svg (source: Logo/Logo-Wide.svg,
 * provided by the Commissioner). Single-line wide lockup, 1035x153, built
 * for dark surfaces. Plain <img> needs the basePath prefixed by hand;
 * NEXT_PUBLIC_BASE_PATH is inlined at build time.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function LogoMark({ height = 36, className = "" }: { height?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${BASE}/logo-wide.svg`}
      alt="The Lions Pool"
      height={height}
      style={{ height, width: "auto" }}
      className={`inline-block ${className}`}
    />
  );
}

export function LogoLockup({ compact = false }: { compact?: boolean }) {
  return <LogoMark height={compact ? 40 : 64} />;
}
