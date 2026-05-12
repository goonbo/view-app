import { db } from "@/db/client";
import { and, eq, type SQL } from "drizzle-orm";

/**
 * Returns a workspace-bound query helper. Every DB read by a route handler
 * must call this — cross-workspace reads (e.g. corporate reading nonprofit
 * events through the partner relationship) are explicit exceptions and
 * must be commented with `// CROSS_WORKSPACE_READ: <justification>`.
 */
export function scopedDb(workspaceId: string) {
  return {
    db,
    workspaceId,
    where: <T extends { workspace_id?: unknown } & Record<string, unknown>>(
      table: T,
      extraConditions?: SQL,
    ) => {
      const col = (table as Record<string, unknown>).workspace_id;
      if (!col) {
        throw new Error(
          "scopedDb.where called on a table without a workspace_id column. Use a manual eq() filter instead.",
        );
      }
      return extraConditions
        ? and(eq(col as never, workspaceId), extraConditions)
        : eq(col as never, workspaceId);
    },
  };
}
