"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchResult = {
  ein: string;
  legal_name: string;
  common_name?: string;
  city?: string;
  state?: string;
  ntee_classification?: string;
  location?: string;
};

export function PartnerSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [beginning, setBeginning] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/propublica/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query]);

  async function beginDiligence(r: SearchResult) {
    setBeginning(r.ein);
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ein: r.ein,
          legal_name: r.legal_name,
          common_name: r.common_name,
          city: r.city,
          state: r.state,
          ntee_classification: r.ntee_classification,
        }),
      });
      if (!res.ok) throw new Error(`Begin failed (${res.status})`);
      const { partnerId } = (await res.json()) as { partnerId: string };
      router.push(`/partners/${partnerId}/diligence`);
    } catch (err) {
      setError((err as Error).message);
      setBeginning(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter an EIN or organization name"
          className="h-12 pl-9 text-[15px]"
        />
        {loading && (
          <Loader2
            aria-hidden
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-faint"
          />
        )}
      </div>
      <p className="font-mono text-[11px] leading-[1.4] text-ink-faint">
        ProPublica searches IRS Form 990 records. EIN format: XX-XXXXXXX.
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.ein}>
              <ResultCard
                r={r}
                pending={beginning === r.ein}
                onBegin={() => beginDiligence(r)}
              />
            </li>
          ))}
        </ul>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-4 py-3 text-[13px] text-ink-subtle">
          No matches in ProPublica yet. Try the org&rsquo;s legal name or full EIN.
        </div>
      )}
    </div>
  );
}

function ResultCard({
  r,
  pending,
  onBegin,
}: {
  r: SearchResult;
  pending: boolean;
  onBegin: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border border-hairline bg-paper px-4 py-3",
        "transition-colors hover:border-ink-faint",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium text-ink">
            {r.common_name || r.legal_name}
          </span>
          {r.ntee_classification && (
            <span className="rounded-sm bg-mist px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {r.ntee_classification}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 font-mono text-[11px] leading-[1.4] text-ink-faint">
          <span>EIN {formatEin(r.ein)}</span>
          {r.location && <span>· {r.location}</span>}
        </div>
      </div>
      <Button
        size="sm"
        onClick={onBegin}
        disabled={pending}
        className="shrink-0"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Begin diligence
        <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}

function formatEin(raw: string): string {
  const c = raw.replace(/-/g, "");
  if (c.length !== 9) return c;
  return `${c.slice(0, 2)}-${c.slice(2)}`;
}
