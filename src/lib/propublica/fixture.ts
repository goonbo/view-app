import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  PropublicaAdapter,
  PropublicaOrganization,
  PropublicaSearchResult,
} from "./types";

async function simulateLatency(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function loadFixture<T>(relativePath: string): Promise<T> {
  const filePath = path.join(process.cwd(), "src", "lib", "fixtures", relativePath);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(
      `Missing ProPublica fixture: ${relativePath}. Run \`DATA_MODE=live CAPTURE_FIXTURES=true pnpm dev\` once to capture it, or check the path.\n  (cause: ${(err as Error).message})`,
    );
  }
}

export class FixturePropublicaAdapter implements PropublicaAdapter {
  async search(query: string): Promise<PropublicaSearchResult[]> {
    await simulateLatency(300, 600);
    const all = await loadFixture<PropublicaSearchResult[]>("propublica/search.json");
    const normalized = query.toLowerCase();
    const cleanedQuery = query.replace(/-/g, "");
    return all
      .filter((r) =>
        r.ein === cleanedQuery ||
        r.legal_name.toLowerCase().includes(normalized) ||
        (r.common_name?.toLowerCase().includes(normalized) ?? false),
      )
      .slice(0, 5);
  }

  async getOrganization(ein: string): Promise<PropublicaOrganization> {
    await simulateLatency(400, 800);
    const cleanEin = ein.replace(/-/g, "");
    const all = await loadFixture<PropublicaOrganization[]>("propublica/organizations.json");
    const org = all.find((o) => o.ein === cleanEin);
    if (!org) {
      throw new Error(
        `No ProPublica fixture for EIN ${ein}. Add it to src/lib/fixtures/propublica/organizations.json or switch to DATA_MODE=live to capture.`,
      );
    }
    return org;
  }
}
