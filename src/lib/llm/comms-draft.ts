import { z } from "zod";

/**
 * System prompt for corporate activation comms — voice from <llm_prompts>:
 * Acme's practical, slightly technical, anti-hype register. Reader is a
 * skeptical mid-market employee.
 */
export const COMMS_DRAFT_SYSTEM = `You are drafting employee-facing communications for a corporate volunteer activation. The reader is an employee at a mid-market company. They are skeptical of corporate communications.

Per channel:

EMAIL — subject line (max 8 words, action-oriented, no clickbait) + body (3-4 short paragraphs, calls out the partner nonprofit by name, includes date/location/signup link, ends with a clear next step)

SLACK — single message, channel-friendly tone, 3-5 sentences total, uses one emoji maximum (or zero), ends with the signup ask. Markdown links acceptable.

CALENDAR — event description as it appears in the meeting invite: 2-3 sentences, factual, includes the agenda summary.

Across all channels:
- Use the company's voice (Acme Robotics) — practical, slightly technical, no hype
- Name the partner nonprofit
- Be concrete about ask (time, place, what to bring)
- Avoid: "join us", "exciting opportunity", "make an impact"
- Allow: "Saturday morning sort at the food bank", "we need 30 hands"`;

export type CommsKind = "email" | "slack" | "calendar";

export const EmailCommsSchema = z.object({
  subject: z.string().min(4).max(80),
  body: z.string().min(40),
});
export type EmailComms = z.infer<typeof EmailCommsSchema>;

export const SlackCommsSchema = z.object({
  body: z.string().min(40),
});
export type SlackComms = z.infer<typeof SlackCommsSchema>;

export const CalendarCommsSchema = z.object({
  body: z.string().min(20),
});
export type CalendarComms = z.infer<typeof CalendarCommsSchema>;

export function commsSchema(kind: CommsKind) {
  if (kind === "email") return EmailCommsSchema;
  if (kind === "slack") return SlackCommsSchema;
  return CalendarCommsSchema;
}

export function commsFixtureKey(eventSlug: string, kind: CommsKind): string {
  return `comms-${eventSlug}-${kind}`;
}

export function buildCommsUserPrompt(opts: {
  kind: CommsKind;
  eventTitle: string;
  nonprofitName: string;
  eventDate: string;
  location?: string | null;
  capacity?: number | null;
  description?: string | null;
  audience: string[];
}): string {
  const channelInstruction =
    opts.kind === "email"
      ? "Generate the EMAIL — subject + body."
      : opts.kind === "slack"
        ? "Generate the SLACK — single message body."
        : "Generate the CALENDAR description body.";

  const lines = [
    `Event: ${opts.eventTitle}`,
    `Partner nonprofit: ${opts.nonprofitName}`,
    `Date: ${opts.eventDate}`,
    opts.location ? `Location: ${opts.location}` : "",
    opts.capacity ? `Capacity: ${opts.capacity} volunteers` : "",
    opts.description ? `Description: ${opts.description}` : "",
    `Audience segments: ${opts.audience.join(", ") || "All staff"}`,
    "",
    channelInstruction,
    "Return only the JSON object that matches the schema. No prose, no markdown fence.",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Slugify an event title for use as part of a fixture key. */
export function eventSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
