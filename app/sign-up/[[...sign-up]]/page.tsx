import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { LogoMark } from "@/components/LogoMark";

// Account creation, same standalone treatment as the front door.
export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-center gap-8">
      <LogoMark height={44} />
      <SignUp />
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-silver">
          {"Already in the pool? "}
          <Link
            href="/sign-in/"
            className="font-bold text-sky underline-offset-2 transition hover:underline"
          >
            Sign in
          </Link>
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fog">
          Mother Superior assigns your nickname. Choose nothing.
        </p>
      </div>
    </div>
  );
}
