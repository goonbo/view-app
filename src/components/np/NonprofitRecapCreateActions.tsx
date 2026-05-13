"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Defaults the period to "current calendar quarter" — the demo lever is
 * one-click "Generate Q3 2026 recap" from the workbench banner; we use
 * the same surface here.
 */
function currentQuarterLabel(d: Date = new Date()): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

export function NonprofitRecapCreateActions() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/np/recaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: currentQuarterLabel() }),
      });
      if (!res.ok) throw new Error(`create ${res.status}`);
      const { recap } = (await res.json()) as { recap: { id: string } };
      router.push(`/np/recap/${recap.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <Button onClick={create} disabled={creating}>
      {creating ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="mr-1 h-3.5 w-3.5" />
      )}
      Generate {currentQuarterLabel()} recap
    </Button>
  );
}
