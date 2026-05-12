import type { ZodSchema } from "zod";

export type StreamTextOpts = {
  fixtureKey: string;
  /** Used in fixture mode when fixtureKey's file isn't present. */
  fixtureFallbackKey?: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
};

export type GenerateObjectOpts<T> = {
  fixtureKey: string;
  /** Used in fixture mode when fixtureKey's file isn't present. */
  fixtureFallbackKey?: string;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodSchema<T>;
  model?: string;
};

export type StreamChunk = { delta: string; delayMs: number };

export type StreamFixture = {
  totalDurationMs: number;
  chunks: StreamChunk[];
};

export interface LLMAdapter {
  streamText(opts: StreamTextOpts): AsyncIterable<string>;
  generateObject<T>(opts: GenerateObjectOpts<T>): Promise<T>;
}

export const DEFAULT_MODEL = "claude-sonnet-4-6";
