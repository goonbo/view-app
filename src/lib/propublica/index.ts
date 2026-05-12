import { getDataMode } from "@/lib/data-mode";
import { LivePropublicaAdapter } from "./live";
import { FixturePropublicaAdapter } from "./fixture";
import type { PropublicaAdapter } from "./types";

export const propublica: PropublicaAdapter =
  getDataMode() === "live" ? new LivePropublicaAdapter() : new FixturePropublicaAdapter();

export type {
  PropublicaAdapter,
  PropublicaOrganization,
  PropublicaSearchResult,
  PropublicaFiling,
} from "./types";
