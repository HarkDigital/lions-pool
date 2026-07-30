"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoLockup } from "./LogoMark";
import { publicName, useSignOut, useUser } from "@/lib/store";

const LINKS = [
  { href: "/", label: "This Week" },
  { href: "/schedule/", label: "Schedule" },
  { href: "/nums/", label: "Nums" },
  { href: "/my-picks/", label: "My Picks" },
  { href: "/rules/", label: "Rules" },
];

export function Nav() {
  const pathname = usePathname();
  const user = useUser();
  const doSignOut = useSignOut();

  // Route-derived, so it is correct in the prerendered HTML of each area.
  const inDemo = /(^|\/)demo(\/|$)/.test(pathname);
  const prefix = inDemo ? "/demo" : "";

  const isActive = (href: string) => {
    const full = `${prefix}${href}`;
    if (href === "/") return pathname === full || pathname === `${prefix}`;
    return pathname.startsWith(full.replace(/\/$/, ""));
  };

  const areaLinks = LINKS.map((l) => ({ ...l, href: `${prefix}${l.href}` }));

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-pitch/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={inDemo ? "/demo/" : "/"} className="shrink-0">
          <LogoLockup compact />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {areaLinks.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                isActive(LINKS[i].href)
                  ? "bg-honolulu/15 text-sky"
                  : "text-fog hover:bg-panel-2 hover:text-silver"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link
              href={`${prefix}/admin/`}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                pathname.startsWith(`${prefix}/admin`)
                  ? "bg-gold/15 text-gold"
                  : "text-gold/70 hover:bg-panel-2 hover:text-gold"
              }`}
            >
              Admin
            </Link>
          )}
          {inDemo ? (
            <Link
              href="/"
              className="rounded-lg border border-gold/40 px-3 py-1.5 text-sm font-semibold text-gold transition hover:bg-gold/10"
            >
              Exit Demo
            </Link>
          ) : (
            <Link
              href="/demo/"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                pathname.startsWith("/demo")
                  ? "bg-gold/15 text-gold"
                  : "text-fog hover:bg-panel-2 hover:text-gold"
              }`}
            >
              Demo
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span
                className="hidden items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs font-bold text-silver sm:inline-flex"
                title={publicName(user)}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: user.avatarColor }}
                />
                {publicName(user)}
              </span>
              <button
                onClick={doSignOut}
                className="rounded-lg border border-edge px-3 py-1.5 text-xs font-bold text-fog transition hover:border-edge-2 hover:text-silver"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href={inDemo ? "/demo/login/" : "/sign-in"}
              className="rounded-lg bg-honolulu px-4 py-1.5 text-sm font-bold text-white transition hover:bg-honolulu-deep"
            >
              Enter the Pool
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {[
          ...areaLinks.map((l, i) => ({ ...l, active: isActive(LINKS[i].href) })),
          ...(user?.isAdmin
            ? [
                {
                  href: `${prefix}/admin/`,
                  label: "Admin",
                  active: pathname.startsWith(`${prefix}/admin`),
                },
              ]
            : []),
          inDemo
            ? { href: "/", label: "Exit Demo", active: false }
            : { href: "/demo/", label: "Demo", active: pathname.startsWith("/demo") },
        ].map((l) => (
          <Link
            key={l.href + l.label}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold ${
              l.active ? "bg-honolulu/15 text-sky" : "text-fog"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
