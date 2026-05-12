import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  GenerateObjectOpts,
  LLMAdapter,
  StreamFixture,
  StreamTextOpts,
} from "./types";

async function readFixture<T>(relativePath: string): Promise<T | null> {
  const filePath = path.join(process.cwd(), "src", "lib", "fixtures", relativePath);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadFixture<T>(primaryKey: string, fallbackKey?: string): Promise<T> {
  const primary = await readFixture<T>(`llm/${primaryKey}.json`);
  if (primary) return primary;
  if (fallbackKey) {
    const fallback = await readFixture<T>(`llm/${fallbackKey}.json`);
    if (fallback) return fallback;
  }
  throw new Error(
    `Missing LLM fixture: llm/${primaryKey}.json${fallbackKey ? ` (no fallback at llm/${fallbackKey}.json either)` : ""}. Run \`DATA_MODE=live CAPTURE_FIXTURES=true pnpm dev\` once to capture it.`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, Math.max(0, ms)));
}

export class FixtureLLMAdapter implements LLMAdapter {
  async *streamText(opts: StreamTextOpts): AsyncIterable<string> {
    const fixture = await loadFixture<StreamFixture>(
      opts.fixtureKey,
      opts.fixtureFallbackKey,
    );
    for (const chunk of fixture.chunks) {
      await sleep(chunk.delayMs);
      yield chunk.delta;
    }
  }

  async generateObject<T>(opts: GenerateObjectOpts<T>): Promise<T> {
    await sleep(800 + Math.random() * 600);
    const fixture = await loadFixture<T>(opts.fixtureKey, opts.fixtureFallbackKey);
    return opts.schema.parse(fixture);
  }
}
