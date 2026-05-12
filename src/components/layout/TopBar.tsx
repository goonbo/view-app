import { DemoModeBadge } from "./DemoModeBadge";
import { DataModeBadge } from "./DataModeBadge";
import { Breadcrumb } from "./Breadcrumb";
import type { WorkspaceRegistryEntry } from "@/lib/workspaces";

type TopBarProps = {
  workspace: WorkspaceRegistryEntry;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * 44px top bar. Server-rendered shell so the badges can read DATA_MODE
 * and DEMO_MODE on the server. The breadcrumb is a tiny client child
 * that subscribes to `usePathname`.
 */
export function TopBar({ workspace }: TopBarProps) {
  return (
    <header
      className="flex h-11 items-center justify-between border-b border-hairline bg-paper px-5"
      role="banner"
    >
      <div className="flex items-center gap-2">
        <Breadcrumb />
      </div>
      <div className="flex items-center gap-3">
        <kbd className="inline-flex items-center rounded-sm border border-hairline px-1.5 py-0.5 font-mono text-[10px] leading-none text-ink-faint">
          ⌘K
        </kbd>
        <DataModeBadge />
        <DemoModeBadge />
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full bg-mist font-mono text-[11px] font-medium text-ink-subtle"
          aria-label={workspace.primaryUser.name}
          title={workspace.primaryUser.name}
        >
          {initials(workspace.primaryUser.name)}
        </div>
      </div>
    </header>
  );
}
