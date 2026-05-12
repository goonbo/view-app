import { WorkspacePickerCards } from "@/components/landing/WorkspacePickerCards";
import { WORKSPACES } from "@/lib/workspaces";

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-mist">
      <div className="mx-auto w-full max-w-[920px] px-8 py-24">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
          VIEW · v0 demo
        </div>

        <h1 className="font-serif text-[64px] leading-[1.05] tracking-tighter text-ink">
          An operating system for corporate volunteering.
        </h1>

        <p className="mt-5 max-w-[58ch] text-[18px] leading-[1.6] text-ink-subtle">
          Two workspaces share one database. The corporate side curates,
          vets, activates. The nonprofit side publishes, manages, recaps.
          The bidirectional architecture is the moat.
        </p>

        <div className="mt-3 font-mono text-[11px] leading-[1.4] text-ink-subtle">
          Pick a workspace to begin.
        </div>

        <div className="mt-12">
          <WorkspacePickerCards workspaces={WORKSPACES} />
        </div>
      </div>
    </div>
  );
}
