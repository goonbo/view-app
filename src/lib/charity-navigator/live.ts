import type { CharityNavigatorAdapter, CharityNavigatorRating } from "./types";

const ENDPOINT = "https://api.charitynavigator.org/v2/graphql";

type GraphQLResponse = {
  data?: {
    rating?: {
      overall_score: number;
      star_rating: 1 | 2 | 3 | 4;
      beacons: { name: string; score: number }[];
      advisories: string[];
      rated_at: string;
    };
  };
};

export class LiveCharityNavigatorAdapter implements CharityNavigatorAdapter {
  isConfigured(): boolean {
    return Boolean(process.env.CHARITY_NAVIGATOR_API_KEY);
  }

  async getRating(ein: string): Promise<CharityNavigatorRating | null> {
    if (!this.isConfigured()) return null;
    const cleanEin = ein.replace(/-/g, "");
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CHARITY_NAVIGATOR_API_KEY}`,
      },
      body: JSON.stringify({
        query: `query Rating($ein: String!) {
          rating(ein: $ein) {
            overall_score
            star_rating
            beacons { name score }
            advisories
            rated_at
          }
        }`,
        variables: { ein: cleanEin },
      }),
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Charity Navigator request failed: ${res.status}`);
    }
    const data = (await res.json()) as GraphQLResponse;
    const rating = data.data?.rating;
    if (!rating) return null;
    return {
      ein: cleanEin,
      overall_score: rating.overall_score,
      star_rating: rating.star_rating,
      beacons: rating.beacons.map((b) => ({
        name: b.name as CharityNavigatorRating["beacons"][number]["name"],
        score: b.score,
      })),
      advisories: rating.advisories,
      rated_at: rating.rated_at,
    };
  }
}
