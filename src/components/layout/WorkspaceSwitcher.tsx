"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { WORKSPACES, type WorkspaceRegistryEntry } from "@/lib/workspaces";

type Props = {
  active: WorkspaceRegistryEntry;
  collapsed?: boolean;
};

export function WorkspaceSwitcher({ active, collapsed = false }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  const switchTo = async (target: WorkspaceRegistryEntry) => {
    if (target.slug === active.slug) return;
    setPending(target.slug);
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: target.slug }),
    });
    router.push(target.homePath);
    router.refresh();
  };

  if (collapsed) {
    return (
      <div className="flex h-9 items-center justify-center">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            active.accent === "cyan" ? "bg-accent-cyan" : "bg-accent-green",
          )}
          aria-label={active.name}
        />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex w-full items-center justify-between gap-2",
          "rounded-md border border-hairline bg-paper px-2.5 py-2",
          "hover:bg-mist",
          "data-[state=open]:bg-mist",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              active.accent === "cyan" ? "bg-accent-cyan" : "bg-accent-green",
            )}
            aria-hidden
          />
          <span className="truncate text-[13px] leading-tight text-ink">
            {active.name}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[220px] p-1"
        sideOffset={4}
      >
        {WORKSPACES.map((ws) => {
          const isActive = ws.slug === active.slug;
          return (
            <DropdownMenuItem
              key={ws.slug}
              onSelect={() => switchTo(ws)}
              className="flex items-center justify-between gap-2 px-2 py-1.5"
              disabled={pending === ws.slug}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    ws.accent === "cyan" ? "bg-accent-cyan" : "bg-accent-green",
                  )}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] leading-tight">{ws.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    {ws.type}
                  </span>
                </span>
              </span>
              {isActive && <Check className="h-3.5 w-3.5 text-accent" aria-hidden />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
