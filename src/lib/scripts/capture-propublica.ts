/**
 * Captures live ProPublica responses for the 5 EINs used in Phase 2 demos.
 * Writes to src/lib/fixtures/propublica/{search,organizations}.json.
 *
 * Run with: npx tsx src/lib/scripts/capture-propublica.ts
 *
 * ProPublica's Nonprofit Explorer API is public (no auth). The capture is
 * deterministic enough to commit to git.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  PropublicaOrganization,
  PropublicaSearchResult,
} from "@/lib/propublica/types";

const BASE = "https://projects.propublica.org/nonprofits/api/v2";

// Five real US-IRS-registered nonprofits.
//
// Three EINs in the v5 build prompt were stale or wrong; we use the
// live-correct versions here so the captures match real API responses:
//   74-1640391 (prompt) → 74-2217350 Central Texas Food Bank Inc
//   94-1196355 (prompt) → 94-3088881 Habitat for Humanity Greater SF
//   13-1644147 (prompt) → 13-5562976 Boys & Girls Clubs of America
//      (the prompt's EIN resolves to Planned Parenthood — typo.)
const TARGETS: Array<{ ein: string; commonName: string }> = [
  { ein: "742217350", commonName: "Central Texas Food Bank" },
  { ein: "530196605", commonName: "American National Red Cross" },
  { ein: "943088881", commonName: "Habitat for Humanity Greater San Francisco" },
  { ein: "363673599", commonName: "Feeding America" },
  { ein: "135562976", commonName: "Boys & Girls Clubs of America" },
  // Also capture the seeded in_diligence partner so its document can hydrate
  // verified-facts and filing-summary from real ProPublica data.
  { ein: "746087356", commonName: "Boys & Girls Clubs of Austin & Travis County" },
];

type RawSearchResponse = {
  organizations?: Array<{
    ein: number | string;
    name: string;
    sub_name?: string;
    city?: string;
    state?: string;
    ntee_code?: string;
  }>;
};

type RawOrgResponse = {
  organization: {
    ein: number | string;
    name: string;
    sub_name?: string;
    address?: string;
    city?: string;
    state?: string;
    ntee_code?: string;
    ruling_date?: string;
    mission?: string;
    website?: string;
    asset_amount?: number;
  };
  filings_with_data?: Array<{
    tax_prd_yr: number;
    filing_date?: string;
    tax_period_begin?: string;
    totrevenue?: number;
    totfuncexpns?: number;
    totprgmrevnue?: number;
    compnsatncurrofcr?: number;
    totassetsend?: number;
  }>;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "VIEW-fixture-capture/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function captureOne(ein: string): Promise<PropublicaOrganization> {
  const raw = await fetchJson<RawOrgResponse>(`${BASE}/organizations/${ein}.json`);
  const filings = (raw.filings_with_data ?? []).slice(0, 3).map((f) => ({
    tax_period: f.tax_prd_yr,
    filing_date: f.filing_date ?? f.tax_period_begin ?? "",
    total_revenue: f.totrevenue ?? 0,
    total_expenses: f.totfuncexpns ?? 0,
    program_service_revenue: f.totprgmrevnue ?? 0,
    executive_comp: f.compnsatncurrofcr,
    total_assets: f.totassetsend ?? 0,
  }));
  return {
    ein,
    legal_name: raw.organization.name,
    common_name: raw.organization.sub_name,
    address: raw.organization.address,
    city: raw.organization.city,
    state: raw.organization.state,
    ntee_classification: raw.organization.ntee_code,
    ruling_date: raw.organization.ruling_date,
    mission: raw.organization.mission,
    website: raw.organization.website,
    total_assets: raw.organization.asset_amount,
    filings,
  };
}

async function captureSearch(query: string): Promise<PropublicaSearchResult[]> {
  const raw = await fetchJson<RawSearchResponse>(
    `${BASE}/search.json?q=${encodeURIComponent(query)}`,
  );
  return (raw.organizations ?? []).slice(0, 5).map((o) => ({
    ein: String(o.ein).replace(/-/g, ""),
    legal_name: o.name,
    common_name: o.sub_name,
    city: o.city,
    state: o.state,
    location: [o.city, o.state].filter(Boolean).join(", "),
    ntee_classification: o.ntee_code,
  }));
}

async function main() {
  const orgs: PropublicaOrganization[] = [];
  const searchByEin = new Map<string, PropublicaSearchResult>();
  const searchByName: PropublicaSearchResult[] = [];

  for (const t of TARGETS) {
    console.log(`Fetching ${t.commonName} (EIN ${t.ein})…`);
    const org = await captureOne(t.ein);
    orgs.push(org);

    // Derive the search result shape directly from the org payload — this
    // is what `/search.json?q={ein}` would return.
    searchByEin.set(t.ein, {
      ein: org.ein,
      legal_name: org.legal_name,
      common_name: org.common_name,
      city: org.city,
      state: org.state,
      location: [org.city, org.state].filter(Boolean).join(", "),
      ntee_classification: org.ntee_classification,
    });

    // And one name-based search so typing partial names finds them.
    const nameResults = await captureSearch(t.commonName);
    for (const r of nameResults) {
      if (!searchByName.find((s) => s.ein === r.ein)) {
        searchByName.push(r);
      }
    }
    await new Promise((r) => setTimeout(r, 400)); // be polite to ProPublica
  }

  const allSearch = Array.from(
    new Map(
      [
        ...Array.from(searchByEin.values()),
        ...searchByName,
      ].map((r) => [r.ein, r]),
    ).values(),
  );

  const fixturesDir = path.join(process.cwd(), "src", "lib", "fixtures", "propublica");
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(
    path.join(fixturesDir, "organizations.json"),
    JSON.stringify(orgs, null, 2),
  );
  await fs.writeFile(
    path.join(fixturesDir, "search.json"),
    JSON.stringify(allSearch, null, 2),
  );

  console.log(`\n✓ Wrote ${orgs.length} organizations and ${allSearch.length} search results.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
