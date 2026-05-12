"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Compass,
  Users,
  HandCoins,
  Megaphone,
  FileBarChart,
  Home,
  Calendar,
  UserRound,
  Building2,
  Settings,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkspaceRegistryEntry } from "@/lib/workspaces";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ClaudeStatusPill, type ClaudeStatus } from "./ClaudeStatusPill";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
};

const CORPORATE_NAV: NavItem[] = [
  { label: "Workbench", href: "/workbench", icon: LayoutGrid },
  { label: "Discover", href: "/discover", icon: Compass },
  { label: "Partners", href: "/partners", icon: Users },
  { label: "Matching", href: "/matching", icon: HandCoins },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Recaps", href: "/recaps", icon: FileBarChart },
];

const NONPROFIT_NAV: NavItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Volunteers", href: "/volunteers", icon: UserRound },
  { label: "Partners", href: "/partners", icon: Building2 },
];

type AppSidebarProps = {
  workspace: WorkspaceRegistryEntry;
  claudeStatus?: ClaudeStatus;
};

export function AppSidebar({
  workspace,
  claudeStatus = { kind: "idle" },
}: AppSidebarProps) {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const items = workspace.type === "corporate" ? CORPORATE_NAV : NONPROFIT_NAV;
  const showClaude = workspace.type === "corporate";

  return (
    <ShadcnSidebar collapsible="icon" className="border-r border-hairline">
      <SidebarHeader className="gap-2 px-3 py-3">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <span className="text-[14px] font-medium tracking-tight text-ink">
              VIEW
            </span>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "rounded-sm p-1 text-ink-faint hover:text-ink-subtle hover:bg-mist",
              collapsed && "mx-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <WorkspaceSwitcher active={workspace} collapsed={collapsed} />

        {showClaude && (
          <div className={cn(collapsed ? "flex justify-center" : "")}>
            <ClaudeStatusPill status={claudeStatus} compact={collapsed} />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu className="gap-px">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href + "/"));
            const Icon = item.icon;

            const buttonInner = (
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className={cn(
                  "h-8 gap-2 rounded-md px-2 py-1.5 text-[14px] font-normal",
                  "text-ink-subtle hover:bg-mist hover:text-ink",
                  isActive &&
                    "bg-[var(--accent-soft)] text-ink hover:bg-[var(--accent-soft)]",
                )}
              >
                <Link href={item.href}>
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-accent" : "text-ink-subtle",
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {isActive && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-1.5 left-0 w-[2px] rounded-r-sm bg-accent"
                    />
                  )}
                </Link>
              </SidebarMenuButton>
            );

            return (
              <SidebarMenuItem key={item.href} className="relative">
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{buttonInner}</TooltipTrigger>
                    <TooltipContent side="right" className="flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.badgeCount && item.badgeCount > 0 && (
                        <span className="rounded-full bg-mist px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle">
                          {item.badgeCount}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  buttonInner
                )}
                {!collapsed && item.badgeCount && item.badgeCount > 0 ? (
                  <SidebarMenuBadge className="bg-mist font-mono text-[10px] text-ink-faint">
                    {item.badgeCount}
                  </SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-hairline px-2 py-2">
        <SidebarMenu className="gap-px">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8 gap-2 rounded-md px-2 py-1.5 text-[14px] font-normal text-ink-subtle hover:bg-mist hover:text-ink"
            >
              <Settings className="h-4 w-4" />
              {!collapsed && <span>Settings</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8 gap-2 rounded-md px-2 py-1.5 text-[14px] font-normal text-ink-subtle hover:bg-mist hover:text-ink"
            >
              <HelpCircle className="h-4 w-4" />
              {!collapsed && <span>Help</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
