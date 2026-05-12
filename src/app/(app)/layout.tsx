import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChromeShell } from "@/components/layout/ChromeShell";
import { WORKSPACES, type WorkspaceRegistryEntry } from "@/lib/workspaces";

/**
 * Single shell for both workspace types. The accent flips between cyan
 * (corporate / operator) and green (nonprofit / field) based on the active
 * workspace, so both registers share one layout file and one set of routes.
 *
 * If no workspace is selected, bounce back to the landing page picker.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const slug = jar.get("view.activeWorkspace")?.value;
  const workspace: WorkspaceRegistryEntry | undefined = slug
    ? WORKSPACES.find((w) => w.slug === slug)
    : undefined;

  if (!workspace) redirect("/");

  const defaultOpen = jar.get("sidebar_state")?.value !== "false";

  return (
    <div data-accent={workspace.accent} className="min-h-svh bg-paper">
      <ChromeShell workspace={workspace} defaultOpen={defaultOpen}>
        {children}
      </ChromeShell>
    </div>
  );
}
