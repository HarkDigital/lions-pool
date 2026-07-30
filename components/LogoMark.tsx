/**
 * The official mark: /public/logo.svg (source: Logo/Logo.svg, provided by the
 * Commissioner). Wide stacked wordmark, 564x208, built for dark surfaces.
 * Plain <img> needs the basePath prefixed by hand; NEXT_PUBLIC_BASE_PATH is
 * inlined at build time.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function LogoMark({ height = 40, className = "" }: { height?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${BASE}/logo.svg`}
      alt="The Lions Pool"
      height={height}
      style={{ height, width: "auto" }}
      className={`inline-block ${className}`}
    />
  );
}

export function LogoLockup({ compact = false }: { compact?: boolean }) {
  return <LogoMark height={compact ? 55 : 90} />;
}
