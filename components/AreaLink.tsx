"use client";

// Area-aware Link: inside /demo/..., internal hrefs get the /demo prefix so
// the simulation never leaks a visitor back to the live site by accident.
// usePathname is route-accurate during prerender, so server HTML is correct.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

export function useAreaPrefix(): string {
  const pathname = usePathname();
  return /(^|\/)demo(\/|$)/.test(pathname) ? "/demo" : "";
}

type AreaLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function AreaLink({ href, ...rest }: AreaLinkProps) {
  const prefix = useAreaPrefix();
  const prefixed = href.startsWith("/") && !href.startsWith("/demo") ? `${prefix}${href}` : href;
  return <Link href={prefixed} {...rest} />;
}
