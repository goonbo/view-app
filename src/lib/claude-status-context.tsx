"use client";

import * as React from "react";
import type { ClaudeStatus } from "@/components/layout/ClaudeStatusPill";

type ClaudeStatusContextValue = {
  status: ClaudeStatus;
  /** Set the live status — passes through to the sidebar pill. */
  setStatus: (next: ClaudeStatus) => void;
  /** Convenience: start an active run with a one-shot action label. */
  beginAction: (action: string) => void;
  endAction: () => void;
};

const Ctx = React.createContext<ClaudeStatusContextValue | null>(null);

export function ClaudeStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatusState] = React.useState<ClaudeStatus>({ kind: "idle" });

  const setStatus = React.useCallback((next: ClaudeStatus) => {
    setStatusState(next);
  }, []);

  const beginAction = React.useCallback((action: string) => {
    setStatusState({ kind: "active", action, startedAt: Date.now() });
  }, []);

  const endAction = React.useCallback(() => {
    setStatusState({ kind: "idle" });
  }, []);

  const value = React.useMemo(
    () => ({ status, setStatus, beginAction, endAction }),
    [status, setStatus, beginAction, endAction],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClaudeStatus(): ClaudeStatusContextValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error("useClaudeStatus must be used inside <ClaudeStatusProvider>.");
  }
  return ctx;
}

/** Idle-tolerant reader — returns `kind: "idle"` if outside the provider. */
export function useClaudeStatusValue(): ClaudeStatus {
  const ctx = React.useContext(Ctx);
  return ctx?.status ?? { kind: "idle" };
}
