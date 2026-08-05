import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { LogoMark } from "@/components/LogoMark";

// Account creation, same standalone treatment as the front door.
export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100svh-7rem)] flex-col items-center justify-center gap-8">
      <LogoMark height={44} />
      <SignUp />
      <p className="text-sm text-silver">
        {"Already in the pool? "}
        <Link
          href="/sign-in/"
          className="font-bold text-sky underline-offset-2 transition hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
