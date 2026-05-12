"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StatusPill } from "@/components/shared/StatusPill";

const FAKE_DONORS = [
  { name: "Alex Park", email: "alex.park@acme.example" },
  { name: "Jordan Lee", email: "jordan.lee@acme.example" },
  { name: "Sam Rivera", email: "sam.rivera@acme.example" },
  { name: "Priya Patel", email: "priya.patel@acme.example" },
  { name: "Chris Nguyen", email: "chris.nguyen@acme.example" },
  { name: "Morgan Hayes", email: "morgan.hayes@acme.example" },
];

type Props = {
  campaignId: string;
  campaignTitle: string;
};

export function SimulateDonationModal({ campaignId, campaignTitle }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(() => pickDonor().name);
  const [email, setEmail] = React.useState(() => pickDonor().email);
  const [amount, setAmount] = React.useState<number>(50);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function pickRandom() {
    const d = pickDonor();
    setName(d.name);
    setEmail(d.email);
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          amount,
          employee_name: name,
          employee_email: email,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Donation failed (${res.status})`);
      }
      const data = (await res.json()) as { donation: { amount: string; match_amount: string } };
      const dAmount = Number(data.donation.amount);
      const dMatch = Number(data.donation.match_amount);
      toast.success(
        `${name} donated $${dAmount.toLocaleString()} to ${campaignTitle}`,
        { description: dMatch > 0 ? `+ $${dMatch.toLocaleString()} match` : undefined },
      );
      setOpen(false);
      // Reset for the next sim
      pickRandom();
      setAmount(50);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Heart className="mr-1.5 h-3.5 w-3.5" />
          Simulate donation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simulate an employee donation</DialogTitle>
          <DialogDescription>
            Creates a donation against this campaign and evaluates the match against your
            active policies. Demo-mode only — no real payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <StatusPill tone="warning" className="self-start">DEMO MODE</StatusPill>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Employee
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-[14px]"
              />
              <Button type="button" variant="ghost" size="sm" onClick={pickRandom}>
                Random
              </Button>
            </div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-mono text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Amount · ${amount.toLocaleString()}
            </Label>
            <input
              type="range"
              min={10}
              max={500}
              step={5}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="flex justify-between font-mono text-[10px] text-ink-faint">
              <span>$10</span>
              <span>$500</span>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-danger">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-hairline pt-3">
            <Button variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={submitting} onClick={submit}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Simulate ${amount}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function pickDonor(): typeof FAKE_DONORS[number] {
  return FAKE_DONORS[Math.floor(Math.random() * FAKE_DONORS.length)];
}
