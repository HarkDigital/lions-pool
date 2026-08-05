"use client";

import { usePathname } from "next/navigation";
import { LogoMark } from "./LogoMark";

export function Footer() {
  const pathname = usePathname();
  const inDemo = /(^|\/)demo(\/|$)/.test(pathname);
  if (/^\/sign-(in|up)/.test(pathname)) return null;
  return (
    <footer className="mt-auto border-t border-edge py-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2.5 px-4 text-center sm:px-6">
        <LogoMark height={26} />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fog">
          This Must Be The Pool
        </p>
        {inDemo && (
          <p className="max-w-xl text-xs text-fog">
            Demo area: the season shown here is simulated. Team names and logos belong to their
            respective clubs; this is a private, just-for-fun pool.
          </p>
        )}
      </div>
    </footer>
  );
}
