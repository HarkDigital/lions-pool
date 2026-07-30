import { SignIn } from "@clerk/nextjs";
import { LogoMark } from "@/components/LogoMark";

// The only page a signed-out visitor ever sees.
export default function SignInPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 py-10">
      <LogoMark height={44} />
      <SignIn />
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fog">
        Members only. Mother Superior knows who you are.
      </p>
    </div>
  );
}
