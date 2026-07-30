"use client";

// ---------------------------------------------------------------------------
// Wraps every /admin route. Blocks rendering until the store hydrates, turns
// away anyone who isn't the Commissioner, and gives Mother a sub-nav so she
// can stalk the whole office without touching the main nav.
// ---------------------------------------------------------------------------

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Card } from "./ui";
import { useHydrated, useUser } from "@/lib/store";

const ADMIN_LINKS = [
  { href: "/admin/", label: "Dashboard" },
  { href: "/admin/submissions/", label: "Submissions" },
  { href: "/admin/contests/", label: "Contest Builder" },
  { href: "/admin/grading/", label: "Grading" },
];

const normalize = (p: string) => p.replace(/\/+$/, "") || "/";

export function AdminGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const user = useUser();
  const pathname = usePathname();

  if (!hydrated) {
    return (
      <Card className="p-10 text-center">
        <div className="text-sm text-fog">Checking your credentials with the front office…</div>
      </Card>
    );
  }

  if (!user?.isAdmin) {
    return (
      <Card className="mx-auto max-w-xl p-10 text-center">
        <div className="display text-3xl">Commissioner access only</div>
        <p className="mt-3 text-sm leading-relaxed text-fog">
          This wing of the pool belongs to Mother. The slates, the inbox, the grading desk —
          all of it. If you are not the Commissioner, there is nothing for you here except
          consequences. Go back to your picks.
        </p>
        <div className="mt-6">
          <Link
            href="/login/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-honolulu px-4 py-2 text-sm font-bold text-white shadow-[0_4px_20px_-6px_rgba(0,118,182,0.7)] transition hover:bg-honolulu-deep"
          >
            Sign in as Mother to see the demo admin
          </Link>
        </div>
      </Card>
    );
  }

  const isActive = (href: string) => normalize(pathname ?? "/") === normalize(href);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-1 rounded-xl border border-edge bg-panel p-1.5">
        {ADMIN_LINKS.map((l) => (
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
        <span className="ml-auto hidden pr-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold/70 sm:inline">
          Mother&apos;s Office
        </span>
      </div>
      {children}
    </div>
  );
}
