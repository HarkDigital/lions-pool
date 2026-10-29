import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { LogoMark } from "@/components/LogoMark";

// The front door. No site chrome, vertically centered, no vendor badge
// (the widget footer is hidden; the sign-up cross-link below is ours).
export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100svh-7rem)] flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <LogoMark height={44} />
        <SignIn />
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <div className="flex w-full items-center gap-3">
            <span className="h-px flex-1 bg-edge-2" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
              New to the pool?
            </span>
            <span className="h-px flex-1 bg-edge-2" />
          </div>
          <Link
            href="/sign-up/"
            className="inline-flex w-full items-center justify-center rounded-lg border-2 border-honolulu bg-honolulu/10 px-8 py-3 text-base font-bold text-sky transition hover:bg-honolulu/25 hover:text-chalk"
          >
            Create your account
          </Link>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-fog">
            Members only.
            <br />
            Mother Superior knows who you are.
          </p>
        </div>
      </div>

      {/* The one public window, pinned to the bottom of the door. Contestants
          whose picks Mother Superior files by hand never sign in, and still
          need to see where they stand. */}
      <div className="mt-auto flex w-full justify-center pt-8">
        <Link
          href="/nums/"
          className="inline-flex w-full max-w-sm items-center justify-center rounded-lg border-2 border-edge-2 bg-panel px-8 py-3 text-base font-bold text-silver transition hover:border-honolulu hover:bg-honolulu/10 hover:text-chalk"
        >
          View Standings
        </Link>
      </div>
    </div>
  );
}
