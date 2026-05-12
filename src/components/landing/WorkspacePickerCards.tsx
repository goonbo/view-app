"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceRegistryEntry } from "@/lib/workspaces";

type Props = {
  workspaces: WorkspaceRegistryEntry[];
};

export function WorkspacePickerCards({ workspaces }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  const pick = async (ws: WorkspaceRegistryEntry) => {
    setPending(ws.slug);
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: ws.slug }),
    });
    router.push(ws.homePath);
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {workspaces.map((ws) => {
        const isCorporate = ws.type === "corporate";
        return (
          <button
            key={ws.slug}
            type="button"
            onClick={() => pick(ws)}
            disabled={pending !== null}
            className={cn(
              "group flex flex-col items-start gap-4 rounded-lg border border-hairline bg-paper p-6 text-left",
              "transition-colors duration-150",
              "hover:border-ink-faint hover:shadow-sm",
              "focus-visible:border-ink-faint",
              "disabled:opacity-60",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isCorporate ? "bg-accent-cyan" : "bg-accent-green",
                )}
                aria-hidden
              />
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
                {ws.type}
              </span>
            </div>

            <div className="flex-1">
              <div className="font-serif text-[24px] leading-[1.15] tracking-tight text-ink">
                {ws.name}
              </div>
              {ws.size && (
                <div className="mt-1 font-mono text-[11px] leading-[1.4] text-ink-faint">
                  {ws.size} employees
                </div>
              )}
              {ws.ein && (
                <div className="mt-1 font-mono text-[11px] leading-[1.4] text-ink-faint">
                  EIN {ws.ein}
                </div>
              )}
            </div>

            <div className="mt-1 flex w-full items-center justify-between">
              <span className="text-[13px] text-ink-subtle">
                Open as {ws.primaryUser.firstName}
              </span>
              <ArrowRight
                className={cn(
                  "h-4 w-4",
                  isCorporate ? "text-accent-cyan" : "text-accent-green",
                  "transition-transform group-hover:translate-x-0.5",
                )}
                aria-hidden
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
