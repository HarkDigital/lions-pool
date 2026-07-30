import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { LogoMark } from "@/components/LogoMark";

// The front door. No site chrome, vertically centered, no vendor badge
// (the widget footer is hidden; the sign-up cross-link below is ours).
export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-center gap-8">
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
  );
}
