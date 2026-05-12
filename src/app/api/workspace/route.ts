import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { WORKSPACES } from "@/lib/workspaces";

const COOKIE = "view.activeWorkspace";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  const { slug } = (await req.json()) as { slug?: string };
  const target = WORKSPACES.find((w) => w.slug === slug);
  if (!target) {
    return NextResponse.json({ error: "Unknown workspace" }, { status: 400 });
  }
  const jar = await cookies();
  jar.set(COOKIE, target.slug, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return NextResponse.json({ ok: true, workspace: target });
}
