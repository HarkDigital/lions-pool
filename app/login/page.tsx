"use client";

// ---------------------------------------------------------------------------
// "Enter the Pool": demo sign-in. Pick a character, become that character.
// The live version runs real accounts through Clerk; here identity is a
// localStorage key and nothing more. Cards show nicknames only; real names
// never render outside the admin wing.
// ---------------------------------------------------------------------------

import { useRouter } from "next/navigation";
import { EVERYONE } from "@/lib/demo-data";
import { publicName, signIn, useHydrated, useStoreVersion } from "@/lib/store";
import { Card, Pill, SectionTitle } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  useStoreVersion();

  const enter = (id: string) => {
    signIn(id);
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionTitle kicker="Demo sign-in">Enter the Pool</SectionTitle>

      <Card className="p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-silver">
          This is the demo, so there are no passwords, no emails, and no waiting for a magic link.
          The live version runs real accounts through Clerk and your picks follow you everywhere.
          Here, you point at a name, you become that person, and everything you do lives in this
          browser only. One click. Even you can manage that.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {EVERYONE.map((p) => (
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
                {hydrated ? publicName(p) : p.nickname}
              </span>
            </span>
            {p.isAdmin && <Pill tone="gold">Commissioner</Pill>}
          </button>
        ))}
      </div>

      <p className="text-center text-sm text-fog">
        Pick a character. The Machine is available if you enjoy losing.
      </p>
    </div>
  );
}
