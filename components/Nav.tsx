"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoLockup } from "./LogoMark";
import { selfName, useSignOut, useUser } from "@/lib/store";

const LINKS = [
  { href: "/", label: "This Week" },
  { href: "/schedule/", label: "Schedule" },
  { href: "/nums/", label: "Nums" },
  { href: "/my-picks/", label: "My Picks" },
  { href: "/rules/", label: "Rules" },
];

type Item = { href: string; label: string; active: boolean; gold?: boolean };

export function Nav() {
  const pathname = usePathname();
  const user = useUser();
  const doSignOut = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu on route change and on Escape.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // The auth screens stand alone: no chrome around the front door.
  if (/^\/sign-(in|up)/.test(pathname)) return null;

  // Route-derived, so it is correct in the prerendered HTML of each area.
  const inDemo = /(^|\/)demo(\/|$)/.test(pathname);
  const prefix = inDemo ? "/demo" : "";

  const isActive = (href: string) => {
    const full = `${prefix}${href}`;
    if (href === "/") return pathname === full || pathname === `${prefix}`;
    return pathname.startsWith(full.replace(/\/$/, ""));
  };

  // One nav model shared by the desktop bar and the mobile menu.
  const items: Item[] = [
    ...LINKS.map((l) => ({ href: `${prefix}${l.href}`, label: l.label, active: isActive(l.href) })),
    ...(user?.isAdmin
      ? [
          {
            href: `${prefix}/admin/`,
            label: "Admin",
            active: pathname.startsWith(`${prefix}/admin`),
            gold: true,
          },
        ]
      : []),
    ...(inDemo
      ? [{ href: "/", label: "Exit Demo", active: false, gold: true }]
      : user?.isAdmin
        ? [{ href: "/demo/", label: "Demo", active: pathname.startsWith("/demo"), gold: true }]
        : []),
  ];

  const deskClass = (l: Item) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
      l.active
        ? l.gold
          ? "bg-gold/15 text-gold"
          : "bg-honolulu/15 text-sky"
        : l.gold
          ? "text-gold/70 hover:bg-panel-2 hover:text-gold"
          : "text-fog hover:bg-panel-2 hover:text-silver"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-pitch/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-[15px] sm:px-6">
        <Link href={inDemo ? "/demo/" : "/"} className="shrink-0">
          <LogoLockup compact />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {items.map((l) => (
            <Link key={l.href + l.label} href={l.href} className={deskClass(l)}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span
                className="hidden items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs font-bold text-silver sm:inline-flex"
                title={selfName(user)}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: user.avatarColor }}
                />
                {selfName(user)}
              </span>
              <button
                onClick={doSignOut}
                className="hidden rounded-lg border border-edge px-3 py-1.5 text-xs font-bold text-fog transition hover:border-edge-2 hover:text-silver sm:inline-flex"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href={inDemo ? "/demo/login/" : "/sign-in"}
              className="hidden rounded-lg bg-honolulu px-4 py-1.5 text-sm font-bold text-white transition hover:bg-honolulu-deep sm:inline-flex"
            >
              Enter the Pool
            </Link>
          )}

          {/* Hamburger — mobile only */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-silver transition hover:border-edge-2 hover:text-chalk md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path
                  d="M4 4l10 10M14 4L4 14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M3 5h12M3 9h12M3 13h12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav className="border-t border-edge bg-pitch/95 px-4 pb-4 pt-2 backdrop-blur md:hidden">
          <div className="flex flex-col gap-1">
            {items.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                  l.active
                    ? l.gold
                      ? "bg-gold/15 text-gold"
                      : "bg-honolulu/15 text-sky"
                    : l.gold
                      ? "text-gold"
                      : "text-silver"
                }`}
              >
                {l.label}
              </Link>
            ))}
            {user && (
              <>
                <div className="my-1 h-px bg-edge" />
                <span className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-fog">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: user.avatarColor }}
                  />
                  {selfName(user)}
                </span>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    doSignOut();
                  }}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-fog hover:text-silver"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
