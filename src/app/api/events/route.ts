import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { auditLog, events, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type Body = {
  title: string;
  description: string;
  location?: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  format?: "onsite" | "remote" | "hybrid" | "skills_based";
  cause_areas?: string[];
  supplies?: string[];
  ai_brief?: string;
  ai_brief_original?: string;
};

/**
 * Persists an AI-drafted event from the nonprofit workspace. After approve,
 * the row is `status: 'open'`, `ai_brief_approved: true` — the corporate
 * side will see it in their /discover feed.
 */
export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json({ error: "Nonprofit workspace required" }, { status: 403 });
  }
  const body = (await req.json()) as Body;
  if (!body.title || !body.starts_at || !body.ends_at || !body.capacity) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [created] = await db
    .insert(events)
    .values({
      nonprofitWorkspaceId: ws.id,
      title: body.title,
      description: body.description,
      location: body.location,
      startsAt: new Date(body.starts_at),
      endsAt: new Date(body.ends_at),
      capacity: body.capacity,
      format: body.format ?? "onsite",
      causeAreas: body.cause_areas ?? ws.causeAreas,
      supplies: body.supplies ?? [],
      aiBrief: body.ai_brief,
      aiBriefOriginal: body.ai_brief_original ?? body.ai_brief,
      aiBriefApproved: true,
      status: "open",
    })
    .returning();

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "event.created",
    targetType: "event",
    targetId: created.id,
    payload: { title: created.title, capacity: created.capacity },
  });

  return NextResponse.json({ event: created });
}
