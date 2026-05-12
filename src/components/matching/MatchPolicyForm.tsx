"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Partner = {
  id: string;
  commonName: string;
  ein: string;
  matchEligible: boolean;
};

type Props = {
  partners: Partner[];
  defaultStart: string;
  defaultEnd: string;
};

const RATIO_OPTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: "0.5×" },
  { value: 1.0, label: "1×" },
  { value: 2.0, label: "2×" },
  { value: 3.0, label: "3×" },
];

export function MatchPolicyForm({ partners, defaultStart, defaultEnd }: Props) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [start, setStart] = React.useState(defaultStart);
  const [end, setEnd] = React.useState(defaultEnd);
  const [eligibleIds, setEligibleIds] = React.useState<Set<string>>(new Set());
  const [ratio, setRatio] = React.useState(1.0);
  const [capPerEmployee, setCapPerEmployee] = React.useState("1000");
  const [capTotal, setCapTotal] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(activate: boolean) {
    setError(null);
    if (!name.trim()) {
      setError("Give the policy a name.");
      return;
    }
    if (eligibleIds.size === 0 && activate) {
      setError("Pick at least one eligible partner before activating.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          eligible_partner_ids: Array.from(eligibleIds),
          match_ratio: ratio,
          cap_per_employee: Number(capPerEmployee) || 0,
          cap_total: capTotal ? Number(capTotal) : null,
          starts_at: new Date(`${start}T00:00:00`).toISOString(),
          ends_at: new Date(`${end}T23:59:59`).toISOString(),
          activate,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Save failed (${res.status})`);
      }
      const data = (await res.json()) as { policy: { id: string } };
      router.push(`/matching/${data.policy.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function togglePartner(id: string, on: boolean) {
    const next = new Set(eligibleIds);
    if (on) next.add(id);
    else next.delete(id);
    setEligibleIds(next);
  }

  return (
    <div className="space-y-6">
      <Field label="Policy name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="2026 Annual Match"
          className="text-[15px]"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts">
          <Input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="text-[15px]"
          />
        </Field>
        <Field label="Ends">
          <Input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="text-[15px]"
          />
        </Field>
      </div>

      <Field label="Eligible partners">
        <p className="mb-2 text-[12px] text-ink-faint">
          Only vetted partners are listed. Run diligence on a new EIN to add more.
        </p>
        {partners.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline bg-mist px-3 py-2 text-[13px] text-ink-subtle">
            No vetted partners yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {partners.map((p) => {
              const checked = eligibleIds.has(p.id);
              return (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-hairline bg-paper px-3 py-2 hover:bg-mist"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => togglePartner(p.id, Boolean(v))}
                  />
                  <span className="flex flex-1 items-center justify-between gap-2">
                    <span className="text-[14px] text-ink">{p.commonName}</span>
                    <span className="font-mono text-[11px] text-ink-faint">
                      EIN {formatEin(p.ein)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Field>

      <Field label="Match ratio">
        <div className="flex items-center gap-1.5">
          {RATIO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRatio(opt.value)}
              className={cn(
                "rounded-md border px-3 py-1.5 font-mono text-[13px] leading-none transition-colors",
                ratio === opt.value
                  ? "border-accent bg-[var(--accent-soft)] text-accent"
                  : "border-hairline bg-paper text-ink-subtle hover:bg-mist",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Per-employee annual cap">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-ink-faint">$</span>
            <Input
              type="number"
              value={capPerEmployee}
              onChange={(e) => setCapPerEmployee(e.target.value)}
              className="pl-6 font-mono text-[15px]"
              min={0}
            />
          </div>
        </Field>
        <Field label="Total program budget cap" optional>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-ink-faint">$</span>
            <Input
              type="number"
              value={capTotal}
              onChange={(e) => setCapTotal(e.target.value)}
              placeholder="No cap"
              className="pl-6 font-mono text-[15px]"
              min={0}
            />
          </div>
        </Field>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-hairline pt-5">
        <Button variant="outline" disabled={submitting} onClick={() => submit(false)}>
          Save draft
        </Button>
        <Button disabled={submitting} onClick={() => submit(true)}>
          {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Activate policy
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
        {optional && <span className="ml-1 text-ink-faint">(optional)</span>}
      </Label>
      {children}
    </div>
  );
}

function formatEin(raw: string): string {
  const c = raw.replace(/-/g, "");
  if (c.length !== 9) return c;
  return `${c.slice(0, 2)}-${c.slice(2)}`;
}
