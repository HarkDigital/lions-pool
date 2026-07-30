"use client";

// ---------------------------------------------------------------------------
// "Enter the Pool". Demo area: pick a fictional character. Live area: only
// Mother Superior exists until the backend brings real accounts. Cards show
// nicknames only; real names never render outside the admin wing.
// ---------------------------------------------------------------------------

import { usePathname, useRouter } from "next/navigation";
import { poolEveryone, publicName, signIn, useHydrated, useStoreVersion } from "@/lib/store";
import { Card, LoadingCard, Pill, SectionTitle } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  useStoreVersion();
  const inDemo = /(^|\/)demo(\/|$)/.test(pathname);

  const enter = (id: string) => {
    signIn(id);
    router.push(inDemo ? "/demo/" : "/");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionTitle kicker={inDemo ? "Demo sign-in" : "Sign in"}>Enter the Pool</SectionTitle>

      <Card className="p-5 sm:p-6">
        {inDemo ? (
          <p className="text-sm leading-relaxed text-silver">
            This is the demo, so there are no passwords, no emails, and no waiting for a magic
            link. You point at a name, you become that person, and everything you do lives in this
            browser only. One click. Even you can manage that.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-silver">
            You came through the front door already; every visitor here is signed in with a real
            account, and Mother Superior assigns every nickname. There is nothing to do on this
            page anymore.
          </p>
        )}
      </Card>

      {!hydrated ? (
        <LoadingCard label="Opening the door" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {poolEveryone().map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => enter(p.id)}
              className="flex items-center gap-3 rounded-xl border border-edge bg-panel p-4 text-left transition hover:border-honolulu/60 hover:bg-panel-2"
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ background: p.avatarColor }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-chalk">
                  {publicName(p)}
                </span>
              </span>
              {p.isAdmin && <Pill tone="gold">Commissioner</Pill>}
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-fog">
        {inDemo
          ? "Pick a character. The Machine is available if you enjoy losing."
          : "Team. Win. Score. The season opens September 13."}
      </p>
    </div>
  );
}
