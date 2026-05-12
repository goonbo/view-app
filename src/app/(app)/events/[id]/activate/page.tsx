import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, nonprofitPartners } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EventActivationFlow } from "@/components/events/EventActivationFlow";

type Props = { params: Promise<{ id: string }> };

export default async function ActivatePage({ params }: Props) {
  const { id } = await params;
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect(`/events/${id}`);

  const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!ev) notFound();

  if (ev.status === "activated") redirect(`/events/${id}`);

  // CROSS_WORKSPACE_READ: corporate-side activation page reads the
  // nonprofit-owned event metadata through the partner relationship.
  const [partner] = await db
    .select()
    .from(nonprofitPartners)
    .where(
      and(
        eq(nonprofitPartners.corporateWorkspaceId, ws.id),
        eq(nonprofitPartners.nonprofitWorkspaceId, ev.nonprofitWorkspaceId),
      ),
    )
    .limit(1);

  if (!partner || partner.status !== "vetted") {
    redirect("/partners");
  }

  return (
    <EventActivationFlow
      event={{
        id: ev.id,
        title: ev.title,
        description: ev.description,
        location: ev.location,
        startsAt: ev.startsAt.toISOString(),
        endsAt: ev.endsAt.toISOString(),
        capacity: ev.capacity,
        format: ev.format,
        partnerName: partner.commonName,
      }}
      approverName={ws.primaryUser.name}
    />
  );
}
