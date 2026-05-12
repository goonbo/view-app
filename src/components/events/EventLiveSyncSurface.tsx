"use client";

import * as React from "react";
import { Plus, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { SourceMarker } from "@/components/shared/SourceMarker";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { cn } from "@/lib/utils";

export type EventLiveData = {
  id: string;
  status: string;
  shared_notes: string;
  supplies: string[];
  capacity: number;
  confirmed_capacity: number | null;
  registered_count: number;
  updated_at: string;
};

type Props = {
  eventId: string;
  /** "corporate" or "nonprofit" — controls write affordances + flash hue. */
  viewerSide: "corporate" | "nonprofit";
  /** Display name of the OTHER side (cross-tenant attribution on source pills). */
  otherSideName: string;
  initial: EventLiveData;
};

/**
 * The bidirectional sync surface. Shared notes and supplies are both
 * presented here. The component:
 *   - Polls /api/events/{id}/live every 2s
 *   - Reflects remote changes within 2s
 *   - Flashes the field briefly when a remote change lands
 *     (cyan flash on the corporate side, green flash on the nonprofit side)
 *   - Lets the viewer edit:
 *       * shared_notes — both sides can edit
 *       * supplies     — nonprofit only; corporate sees read-only with source pill
 */
export function EventLiveSyncSurface({
  eventId,
  viewerSide,
  otherSideName,
  initial,
}: Props) {
  const { data } = useLiveData<EventLiveData>(
    `event-live-${eventId}`,
    async () => {
      const res = await fetch(`/api/events/${eventId}/live`);
      if (!res.ok) throw new Error(`live fetch ${res.status}`);
      return (await res.json()) as EventLiveData;
    },
    { intervalMs: 2000, initial },
  );

  const remote = data ?? initial;

  return (
    <div className="space-y-6">
      <SharedNotesField
        eventId={eventId}
        viewerSide={viewerSide}
        otherSideName={otherSideName}
        remoteValue={remote.shared_notes}
      />
      <SuppliesField
        eventId={eventId}
        viewerSide={viewerSide}
        otherSideName={otherSideName}
        remoteValue={remote.supplies}
      />
      <CapacityRow
        viewerSide={viewerSide}
        capacity={remote.capacity}
        confirmedCapacity={remote.confirmed_capacity}
        registered={remote.registered_count}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared notes — editable on both sides, flashes on remote change.

function SharedNotesField({
  eventId,
  viewerSide,
  otherSideName,
  remoteValue,
}: {
  eventId: string;
  viewerSide: "corporate" | "nonprofit";
  otherSideName: string;
  remoteValue: string;
}) {
  const [local, setLocal] = React.useState(remoteValue);
  const [dirty, setDirty] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [flash, setFlash] = React.useState(false);
  const prevRemoteRef = React.useRef(remoteValue);
  const focusRef = React.useRef<HTMLTextAreaElement | null>(null);
  const isFocused = () => document.activeElement === focusRef.current;

  // When the polled value lands AND the viewer isn't actively editing,
  // sync local state and flash the field.
  React.useEffect(() => {
    if (remoteValue === prevRemoteRef.current) return;
    prevRemoteRef.current = remoteValue;
    if (!isFocused() && !dirty) {
      setLocal(remoteValue);
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 900);
      return () => window.clearTimeout(t);
    }
  }, [remoteValue, dirty]);

  async function save() {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/events/${eventId}/shared-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared_notes: local }),
      });
      if (!res.ok) throw new Error(`save ${res.status}`);
      prevRemoteRef.current = local;
      setDirty(false);
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 1500);
    } catch {
      setSaveStatus("failed");
    }
  }

  function revert() {
    setLocal(remoteValue);
    setDirty(false);
    setSaveStatus("idle");
  }

  const flashClass =
    viewerSide === "corporate"
      ? "ring-2 ring-cyan-200"
      : "ring-2 ring-green-200";

  return (
    <section
      className={cn(
        "rounded-md border border-hairline bg-paper p-5 transition-shadow",
        flash && flashClass,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <EyebrowLabel>SHARED NOTES</EyebrowLabel>
          <SourceMarker
            origin={viewerSide === "corporate" ? "nonprofit" : "corporate"}
            fromName={`syncs with ${otherSideName}`}
          />
        </div>
        <span className="font-mono text-[10px] text-ink-faint">
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
              ? "Saved"
              : saveStatus === "failed"
                ? "Failed — retry"
                : dirty
                  ? "Unsaved"
                  : "Up to date"}
        </span>
      </div>
      <Textarea
        ref={focusRef}
        rows={4}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          setDirty(true);
          if (saveStatus === "saved") setSaveStatus("idle");
        }}
        placeholder="Share day-of details, parking, logistics — both sides can edit."
        className="text-[14px] leading-[1.55]"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        {dirty && (
          <Button variant="ghost" size="sm" onClick={revert}>
            Revert
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={!dirty || saveStatus === "saving"}>
          {saveStatus === "saving" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {saveStatus === "saved" ? (
            <>
              <Check className="mr-1 h-3 w-3" />
              Saved
            </>
          ) : (
            "Save notes"
          )}
        </Button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Supplies — read-only on corporate, editable on nonprofit.

function SuppliesField({
  eventId,
  viewerSide,
  otherSideName,
  remoteValue,
}: {
  eventId: string;
  viewerSide: "corporate" | "nonprofit";
  otherSideName: string;
  remoteValue: string[];
}) {
  const [local, setLocal] = React.useState<string[]>(remoteValue);
  const [draft, setDraft] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [flash, setFlash] = React.useState(false);
  const prevRemoteRef = React.useRef(remoteValue);

  React.useEffect(() => {
    if (arraysEqual(remoteValue, prevRemoteRef.current)) return;
    prevRemoteRef.current = remoteValue;
    if (!dirty) {
      setLocal(remoteValue);
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 900);
      return () => window.clearTimeout(t);
    }
  }, [remoteValue, dirty]);

  async function save(next: string[]) {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/events/${eventId}/supplies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplies: next }),
      });
      if (!res.ok) throw new Error(`save ${res.status}`);
      prevRemoteRef.current = next;
      setDirty(false);
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 1500);
    } catch {
      setSaveStatus("failed");
    }
  }

  function add() {
    const v = draft.trim();
    if (!v) return;
    const next = [...local, v];
    setLocal(next);
    setDraft("");
    setDirty(true);
    void save(next);
  }

  function remove(i: number) {
    const next = local.filter((_, idx) => idx !== i);
    setLocal(next);
    setDirty(true);
    void save(next);
  }

  const editable = viewerSide === "nonprofit";

  const flashClass =
    viewerSide === "corporate"
      ? "ring-2 ring-cyan-200"
      : "ring-2 ring-green-200";

  return (
    <section
      className={cn(
        "rounded-md border border-hairline bg-paper p-5 transition-shadow",
        flash && flashClass,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <EyebrowLabel>SUPPLIES NEEDED</EyebrowLabel>
          <SourceMarker
            origin="nonprofit"
            fromName={
              viewerSide === "corporate"
                ? `From ${otherSideName}`
                : "Editable by your team"
            }
          />
        </div>
        {viewerSide === "corporate" && (
          <span className="font-mono text-[10px] text-ink-faint">read-only</span>
        )}
        {viewerSide === "nonprofit" && saveStatus !== "idle" && (
          <span className="font-mono text-[10px] text-ink-faint">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Failed"}
          </span>
        )}
      </div>
      {local.length === 0 ? (
        <p className="text-[13px] text-ink-subtle">No supplies recorded yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {local.map((item, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-paper px-3 py-1.5 text-[13px] text-ink"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-ink-faint" />
                {item}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-ink-faint hover:text-danger"
                  aria-label={`Remove ${item}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add a supply (Enter to add)"
            className="h-8 text-[13px]"
          />
          <Button size="sm" variant="outline" onClick={add} disabled={!draft.trim()}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Capacity — passive, both sides see it.

function CapacityRow({
  viewerSide,
  capacity,
  confirmedCapacity,
  registered,
}: {
  viewerSide: "corporate" | "nonprofit";
  capacity: number;
  confirmedCapacity: number | null;
  registered: number;
}) {
  const cap = confirmedCapacity ?? capacity;
  const pct = cap > 0 ? Math.min(100, (registered / cap) * 100) : 0;
  return (
    <section className="rounded-md border border-hairline bg-paper p-5">
      <div className="mb-2 flex items-center gap-2">
        <EyebrowLabel>SIGNUPS</EyebrowLabel>
        <SourceMarker
          origin={viewerSide === "corporate" ? "corporate" : "corporate"}
          fromName="from your team"
        />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="font-mono text-[20px] font-medium text-ink">{registered}</span>
          <span className="ml-1 text-[14px] text-ink-subtle">
            of {cap} {confirmedCapacity ? "confirmed" : "requested"}
          </span>
        </div>
        <span className="font-mono text-[11px] text-ink-faint">{Math.round(pct)}% filled</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-mist">
        <div className="h-1 bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
