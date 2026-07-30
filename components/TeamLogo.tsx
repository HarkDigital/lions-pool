import { teamInfo, teamLogoUrl } from "@/lib/teams";

/** Team logo from ESPN's public CDN, with an initials fallback ring. */
export function TeamLogo({
  abbr,
  size = 40,
  className = "",
}: {
  abbr: string;
  size?: number;
  className?: string;
}) {
  const t = teamInfo(abbr);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={teamLogoUrl(abbr)}
      alt={`${t.name} logo`}
      width={size}
      height={size}
      loading="lazy"
      className={`inline-block object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
