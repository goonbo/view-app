"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { SourceMarker } from "@/components/shared/SourceMarker";
import { CommsDraftPanel, type CommsDraftRow, type CommsKind } from "./CommsDraftPanel";
import { useClaudeStatus } from "@/lib/claude-status-context";
import { cn } from "@/lib/utils";

type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  format: string;
  partnerName: string;
};

type Props = {
  event: EventSummary;
  approverName: string;
};

const AUDIENCE_SEGMENTS = [
  "All staff",
  "Engineering",
  "SF office",
  "Austin office",
  "Marketing",
];

const CHANNEL_OPTIONS: { value: CommsKind; label: string; helper: string }[] = [
  { value: "email", label: "Email", helper: "Subject + body, professional tone" },
  { value: "slack", label: "Slack", helper: "Channel-friendly, one emoji max" },
  { value: "calendar", label: "Calendar invite", helper: "Event description" },
];

export function EventActivationFlow({ event, approverName }: Props) {
  const router = useRouter();
  const { beginAction, endAction } = useClaudeStatus();
  const [audience, setAudience] = React.useState<string[]>(["All staff"]);
  const [channels, setChannels] = React.useState<CommsKind[]>(["email", "slack", "calendar"]);
  const [drafting, setDrafting] = React.useState(false);
  const [drafts, setDrafts] = React.useState<CommsDraftRow[]>([]);
  const [approvedIds, setApprovedIds] = React.useState<Set<string>>(new Set());
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const allApproved = drafts.length > 0 && approvedIds.size === drafts.length;

  async function draft() {
    if (!channels.length) {
      setError("Pick at least one channel.");
      return;
    }
    setError(null);
    setDrafting(true);
    beginAction(`drafting ${channels.length} comms`);
    try {
      const res = await fetch(`/api/events/${event.id}/draft-comms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels, audience }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Draft failed (${res.status})`);
      }
      const data = (await res.json()) as { drafts: CommsDraftRow[] };
      setDrafts(data.drafts);
      setApprovedIds(new Set());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDrafting(false);
      endAction();
    }
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, estimated_audience_size: 100 }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Send failed (${res.status})`);
      }
      const data = (await res.json()) as { sentDrafts: number };
      toast.success(`Activation sent to ${audience.join(", ").toLowerCase()}`, {
        description: `${data.sentDrafts} comms delivered`,
      });
      router.push(`/events/${event.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/discover"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-subtle hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Discover
        </Link>
        <EyebrowLabel className="mt-2 mb-1">ACTIVATE EVENT</EyebrowLabel>
        <h1 className="font-sans text-[22px] font-medium leading-[1.2] tracking-tight text-ink">
          {event.title}
        </h1>
        <p className="mt-1 text-[14px] leading-[1.5] text-ink-subtle">
          <SourceMarker origin="nonprofit" fromName={event.partnerName} className="mr-2" />
          published this event
        </p>
      </div>

      {/* Event details (read-only with source pills) */}
      <section className="rounded-md border border-hairline bg-paper p-5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
          Event details · from {event.partnerName}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Field label="When">
            {formatDate(event.startsAt)} · {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
          </Field>
          <Field label="Where">{event.location ?? "—"}</Field>
          <Field label="Capacity">
            <span className="font-mono">{event.capacity}</span> · {event.format}
          </Field>
          <Field label="Description" full>
            {event.description}
          </Field>
        </dl>
      </section>

      {/* Audience + Channels */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-md border border-hairline bg-paper p-5">
          <EyebrowLabel className="mb-3">AUDIENCE</EyebrowLabel>
          <div className="space-y-2">
            {AUDIENCE_SEGMENTS.map((seg) => {
              const checked = audience.includes(seg);
              return (
                <label key={seg} className="flex items-center gap-2 text-[14px]">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      setAudience((prev) =>
                        v ? Array.from(new Set([...prev, seg])) : prev.filter((s) => s !== seg),
                      );
                    }}
                  />
                  <span>{seg}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-paper p-5">
          <EyebrowLabel className="mb-3">CHANNELS</EyebrowLabel>
          <div className="space-y-2">
            {CHANNEL_OPTIONS.map((c) => {
              const checked = channels.includes(c.value);
              return (
                <label key={c.value} className="flex items-start gap-2 text-[14px]">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      setChannels((prev) =>
                        v
                          ? (Array.from(new Set([...prev, c.value])) as CommsKind[])
                          : prev.filter((x) => x !== c.value),
                      );
                    }}
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span>{c.label}</span>
                    <span className="font-mono text-[10px] text-ink-faint">{c.helper}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* Draft trigger */}
      {drafts.length === 0 && (
        <div className="flex items-center justify-between rounded-md border border-hairline bg-mist px-5 py-3">
          <p className="text-[13px] text-ink-subtle">
            Claude drafts {channels.length} comm{channels.length === 1 ? "" : "s"} for {audience.join(", ").toLowerCase()}.
          </p>
          <Button onClick={draft} disabled={drafting || !channels.length}>
            {drafting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Draft comms with Claude
          </Button>
        </div>
      )}

      {drafts.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <EyebrowLabel>COMMS DRAFTS · {approvedIds.size}/{drafts.length} APPROVED</EyebrowLabel>
            {!sending && (
              <button
                type="button"
                onClick={draft}
                className="font-mono text-[11px] uppercase tracking-wider text-ink-subtle hover:text-ink"
                disabled={drafting}
              >
                Re-roll drafts
              </button>
            )}
          </div>
          <div className={cn("grid gap-4", drafts.length >= 3 ? "lg:grid-cols-3" : drafts.length === 2 ? "lg:grid-cols-2" : "")}>
            {drafts.map((d) => (
              <CommsDraftPanel
                key={d.id}
                initial={d}
                approverName={approverName}
                onApproved={() => setApprovedIds((s) => new Set(s).add(d.id))}
                onRejected={() =>
                  setApprovedIds((s) => {
                    const next = new Set(s);
                    next.delete(d.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          <Button
            onClick={send}
            disabled={!allApproved || sending}
            size="lg"
          >
            {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Send to audience
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="mb-0.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
        <SourceMarker origin="nonprofit" />
      </dt>
      <dd className="text-[14px] text-ink">{children}</dd>
    </div>
  );
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(s: string): string {
  return new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
