export type CharityNavigatorBeacon = {
  name: "accountability_finance" | "impact_results" | "culture_community" | "leadership_adaptability";
  score: number;
};

export type CharityNavigatorRating = {
  ein: string;
  overall_score: number;
  star_rating: 1 | 2 | 3 | 4;
  beacons: CharityNavigatorBeacon[];
  advisories: string[];
  rated_at: string;
};

export interface CharityNavigatorAdapter {
  /** Returns null if not configured or not rated. */
  getRating(ein: string): Promise<CharityNavigatorRating | null>;
  isConfigured(): boolean;
}
