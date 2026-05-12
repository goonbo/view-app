import { isDemoMode } from "@/lib/data-mode";

/**
 * Top-bar pill announcing DEMO MODE. Only rendered when DEMO_MODE !== "false".
 * Amber-700 on amber-50 — uses the system `warning` token.
 */
export function DemoModeBadge() {
  if (!isDemoMode()) return null;
  return (
    <span className="inline-flex items-center rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-warning">
      Demo mode
    </span>
  );
}
