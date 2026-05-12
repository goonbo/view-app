import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, snoozes, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type Body = {
  target_type: "diligence" | "comms" | "recap" | "event";
  target_id: string;
  /** "tomorrow" | "next_week" | ISO timestamp */
  until: string;
};

export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const body = (await req.json()) as Body;

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);
  if (!primary) return NextResponse.json({ error: "No user" }, { status: 500 });

  const snoozedUntil = resolveUntil(body.until);

  const [created] = await db
    .insert(snoozes)
    .values({
      workspaceId: ws.id,
      userId: primary.id,
      targetType: body.target_type,
      targetId: body.target_id,
      snoozedUntil,
    })
    .returning();

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary.id,
    actorKind: "user",
    action: "snooze.created",
    targetType: body.target_type,
    targetId: body.target_id,
    payload: { until: snoozedUntil.toISOString() },
  });

  return NextResponse.json({ snooze: created });
}

function resolveUntil(input: string): Date {
  const now = new Date();
  if (input === "tomorrow") {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  if (input === "next_week") {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  const parsed = new Date(input);
  if (Number.isFinite(parsed.getTime())) return parsed;
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
