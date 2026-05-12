import { getDataMode } from "@/lib/data-mode";
import { LiveLLMAdapter } from "./live";
import { FixtureLLMAdapter } from "./fixture";
import type { LLMAdapter } from "./types";

export const llm: LLMAdapter =
  getDataMode() === "live" ? new LiveLLMAdapter() : new FixtureLLMAdapter();

export type {
  LLMAdapter,
  StreamTextOpts,
  GenerateObjectOpts,
  StreamFixture,
  StreamChunk,
} from "./types";
export { DEFAULT_MODEL } from "./types";
