"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoLockup } from "./LogoMark";
import { publicName, signOut, useUser } from "@/lib/store";

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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, ""));

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-pitch/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0">
          <LogoLockup compact />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                isActive(l.href)
                  ? "bg-honolulu/15 text-sky"
                  : "text-fog hover:bg-panel-2 hover:text-silver"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link
              href="/admin/"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                isActive("/admin/")
                  ? "bg-gold/15 text-gold"
                  : "text-gold/70 hover:bg-panel-2 hover:text-gold"
              }`}
            >
              Admin
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
                onClick={signOut}
                className="rounded-lg border border-edge px-3 py-1.5 text-xs font-bold text-fog transition hover:border-edge-2 hover:text-silver"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login/"
              className="rounded-lg bg-honolulu px-4 py-1.5 text-sm font-bold text-white transition hover:bg-honolulu-deep"
            >
              Enter the Pool
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {[...LINKS, ...(user?.isAdmin ? [{ href: "/admin/", label: "Admin" }] : [])].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold ${
              isActive(l.href) ? "bg-honolulu/15 text-sky" : "text-fog"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
