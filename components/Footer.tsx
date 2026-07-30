import { LogoMark } from "./LogoMark";

export function Footer() {
  return (
    <footer className="border-t border-edge py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 text-center sm:px-6">
        <LogoMark height={42} />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fog">
          Team. Win. Score. Don&apos;t Be an Idiot.
        </p>
        <p className="max-w-xl text-xs text-fog">
          Demo site for the 2026 season. Picks and Nums shown here are simulated. Team names and
          logos belong to their respective clubs; this is a private, just-for-fun pool.
        </p>
      </div>
    </footer>
  );
}
