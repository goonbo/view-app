import "server-only";
import { cookies } from "next/headers";
import {
  WORKSPACES,
  type WorkspaceRegistryEntry,
} from "./workspaces";

const COOKIE = "view.activeWorkspace";

/**
 * Returns whatever workspace the cookie points to, or undefined if none
 * is set. The `(app)/layout.tsx` shell redirects to `/` when undefined,
 * so route handlers / pages can assume a workspace exists by the time
 * their server component runs.
 */
export async function getActiveWorkspace(): Promise<WorkspaceRegistryEntry | undefined> {
  const jar = await cookies();
  const slug = jar.get(COOKIE)?.value;
  if (!slug) return undefined;
  return WORKSPACES.find((w) => w.slug === slug);
}

/** Bang variant for callers that have already passed through the shell guard. */
export async function getActiveWorkspaceOrThrow(): Promise<WorkspaceRegistryEntry> {
  const ws = await getActiveWorkspace();
  if (!ws) {
    throw new Error("No active workspace. Bounce through `/` first.");
  }
  return ws;
}
