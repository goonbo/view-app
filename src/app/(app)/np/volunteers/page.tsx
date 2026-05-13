import { redirect } from "next/navigation";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import {
  listVolunteerProfiles,
  listVolunteerTags,
} from "@/lib/volunteer-profile";
import { VolunteerList } from "@/components/np/VolunteerList";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect("/workbench");

  const profiles = await listVolunteerProfiles(ws.id);
  const tags = await listVolunteerTags(ws.id);

  // The list is server-rendered with all profiles; the client component
  // applies filters from search params so URLs stay shareable.
  const sp = await searchParams;
  return (
    <div className="space-y-5">
      <div>
        <EyebrowLabel className="mb-1">VOLUNTEERS</EyebrowLabel>
        <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
          {profiles.length} active volunteers
        </h1>
        <p className="mt-1 text-[14px] leading-[1.6] text-ink-subtle">
          Tracked across corporate partners. Filter by employer, tag, or
          attendance frequency.
        </p>
      </div>

      <VolunteerList
        profiles={profiles.map((p) => ({
          ...p,
          firstSeenAt: p.firstSeenAt.toISOString(),
          lastSeenAt: p.lastSeenAt.toISOString(),
        }))}
        tags={tags}
        initialFilters={{
          employer: asString(sp.employer) ?? "all",
          tag: asString(sp.tag) ?? "all",
          frequency: asString(sp.frequency) ?? "all",
        }}
      />
    </div>
  );
}

function asString(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
