"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EventOption = { id: string; title: string };

type Props = {
  completedEvents: EventOption[];
};

export function RecapCreateActions({ completedEvents }: Props) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  async function create(scope: "event" | "quarterly", eventId?: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/recaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, event_id: eventId }),
      });
      if (!res.ok) throw new Error(`create ${res.status}`);
      const { recap } = (await res.json()) as { recap: { id: string } };
      router.push(`/recaps/${recap.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {completedEvents.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={creating}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Recap from event
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {completedEvents.map((e) => (
              <DropdownMenuItem key={e.id} onSelect={() => create("event", e.id)}>
                {e.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button onClick={() => create("quarterly")} disabled={creating}>
        {creating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
        Generate quarterly recap
      </Button>
    </div>
  );
}
