"use client";

import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ClaudeStatusProvider, useClaudeStatusValue } from "@/lib/claude-status-context";
import type { WorkspaceRegistryEntry } from "@/lib/workspaces";

type Props = {
  workspace: WorkspaceRegistryEntry;
  defaultOpen: boolean;
  children: React.ReactNode;
};

/**
 * Client shell around the `(app)/layout.tsx` server component. Mounts the
 * Claude status provider so any page can broadcast streaming activity to
 * the sidebar pill, then renders the sidebar + top bar.
 */
export function ChromeShell({ workspace, defaultOpen, children }: Props) {
  return (
    <ClaudeStatusProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={
          {
            "--sidebar-width": "240px",
            "--sidebar-width-icon": "56px",
          } as React.CSSProperties
        }
      >
        <SidebarWithStatus workspace={workspace} />
        <SidebarInset className="min-w-0 bg-paper">
          <TopBar workspace={workspace} />
          {/* Content area owns horizontal overflow so the fixed sidebar
              never overlaps when narrow viewports force a side-scroll. */}
          <main className="flex-1 overflow-x-auto px-5 py-6">
            <div className="mx-auto w-full max-w-[1240px] min-w-[960px]">
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ClaudeStatusProvider>
  );
}

function SidebarWithStatus({ workspace }: { workspace: WorkspaceRegistryEntry }) {
  const status = useClaudeStatusValue();
  return <AppSidebar workspace={workspace} claudeStatus={status} />;
}
