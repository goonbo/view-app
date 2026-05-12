import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isCapturingFixtures } from "@/lib/data-mode";
import type {
  GenerateObjectOpts,
  LLMAdapter,
  StreamChunk,
  StreamFixture,
  StreamTextOpts,
} from "./types";
import { DEFAULT_MODEL } from "./types";

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required for DATA_MODE=live. Set it in .env.local or switch to fixture mode.",
    );
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function writeFixture(relativePath: string, contents: unknown): Promise<void> {
  const filePath = path.join(process.cwd(), "src", "lib", "fixtures", relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(contents, null, 2));
}

export class LiveLLMAdapter implements LLMAdapter {
  async *streamText(opts: StreamTextOpts): AsyncIterable<string> {
    const c = client();
    const chunks: StreamChunk[] = [];
    const start = Date.now();
    let lastTick = start;

    const stream = await c.messages.stream({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: opts.userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const text = event.delta.text;
        const now = Date.now();
        chunks.push({ delta: text, delayMs: now - lastTick });
        lastTick = now;
        yield text;
      }
    }

    if (isCapturingFixtures()) {
      const fixture: StreamFixture = {
        totalDurationMs: Date.now() - start,
        chunks,
      };
      await writeFixture(`llm/${opts.fixtureKey}.json`, fixture);
    }
  }

  async generateObject<T>(opts: GenerateObjectOpts<T>): Promise<T> {
    const c = client();
    const res = await c.messages.create({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: 2048,
      system: `${opts.systemPrompt}\n\nReturn only a JSON object that conforms exactly to the schema described in the user prompt. No prose, no markdown fence.`,
      messages: [{ role: "user", content: opts.userPrompt }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Anthropic generateObject: no text block returned");
    }
    const json = extractJson(block.text);
    const parsed = opts.schema.parse(json);
    if (isCapturingFixtures()) {
      await writeFixture(`llm/${opts.fixtureKey}.json`, parsed);
    }
    return parsed;
  }
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const body = fenceMatch ? fenceMatch[1] : trimmed;
  return JSON.parse(body);
}
