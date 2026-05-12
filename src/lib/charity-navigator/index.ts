import { getDataMode } from "@/lib/data-mode";
import { LiveCharityNavigatorAdapter } from "./live";
import { FixtureCharityNavigatorAdapter } from "./fixture";
import type { CharityNavigatorAdapter } from "./types";

export const charityNavigator: CharityNavigatorAdapter =
  getDataMode() === "live"
    ? new LiveCharityNavigatorAdapter()
    : new FixtureCharityNavigatorAdapter();

export type {
  CharityNavigatorAdapter,
  CharityNavigatorRating,
  CharityNavigatorBeacon,
} from "./types";
