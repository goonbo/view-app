import { promises as fs } from "node:fs";
import path from "node:path";
import type { CharityNavigatorAdapter, CharityNavigatorRating } from "./types";

async function simulateLatency(min: number, max: number): Promise<void> {
  const delay = Math.random() * (max - min) + min;
  await new Promise((r) => setTimeout(r, delay));
}

export class FixtureCharityNavigatorAdapter implements CharityNavigatorAdapter {
  isConfigured(): boolean {
    // In fixture mode, we report "configured" if a matching EIN fixture exists.
    return true;
  }

  async getRating(ein: string): Promise<CharityNavigatorRating | null> {
    await simulateLatency(300, 700);
    const cleanEin = ein.replace(/-/g, "");
    const filePath = path.join(
      process.cwd(),
      "src",
      "lib",
      "fixtures",
      "charity-navigator",
      `${cleanEin}.json`,
    );
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw) as CharityNavigatorRating;
    } catch {
      return null;
    }
  }
}
