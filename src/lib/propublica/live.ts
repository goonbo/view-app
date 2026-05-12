import type {
  PropublicaAdapter,
  PropublicaFiling,
  PropublicaOrganization,
  PropublicaSearchResult,
} from "./types";

const BASE = "https://projects.propublica.org/nonprofits/api/v2";
const TTL_MS = 60_000;

type CacheEntry = { value: unknown; expiresAt: number };

export class LivePropublicaAdapter implements PropublicaAdapter {
  private cache = new Map<string, CacheEntry>();

  async search(query: string): Promise<PropublicaSearchResult[]> {
    const key = `search:${query}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as PropublicaSearchResult[];
    }
    const res = await fetch(`${BASE}/search.json?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`ProPublica search failed: ${res.status}`);
    const data = (await res.json()) as { organizations: RawOrg[] };
    const results: PropublicaSearchResult[] = (data.organizations ?? []).slice(0, 5).map((o) => ({
      ein: String(o.ein).replace(/-/g, ""),
      legal_name: o.name,
      common_name: o.sub_name,
      city: o.city,
      state: o.state,
      location: [o.city, o.state].filter(Boolean).join(", "),
      ntee_classification: o.ntee_code,
    }));
    this.cache.set(key, { value: results, expiresAt: Date.now() + TTL_MS });
    return results;
  }

  async getOrganization(ein: string): Promise<PropublicaOrganization> {
    const cleanEin = ein.replace(/-/g, "");
    const key = `org:${cleanEin}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as PropublicaOrganization;
    }
    const res = await fetch(`${BASE}/organizations/${cleanEin}.json`);
    if (!res.ok) throw new Error(`ProPublica getOrganization failed: ${res.status}`);
    const data = (await res.json()) as RawOrgResponse;
    const org: PropublicaOrganization = {
      ein: cleanEin,
      legal_name: data.organization.name,
      common_name: data.organization.sub_name,
      address: data.organization.address,
      city: data.organization.city,
      state: data.organization.state,
      ntee_classification: data.organization.ntee_code,
      ruling_date: data.organization.ruling_date,
      mission: data.organization.mission,
      website: data.organization.website,
      total_assets: data.organization.asset_amount,
      filings: (data.filings_with_data ?? []).slice(0, 3).map(mapFiling),
    };
    this.cache.set(key, { value: org, expiresAt: Date.now() + TTL_MS });
    return org;
  }
}

type RawOrg = {
  ein: number | string;
  name: string;
  sub_name?: string;
  city?: string;
  state?: string;
  ntee_code?: string;
};

type RawOrgResponse = {
  organization: RawOrg & {
    address?: string;
    ruling_date?: string;
    mission?: string;
    website?: string;
    asset_amount?: number;
  };
  filings_with_data?: RawFiling[];
};

type RawFiling = {
  tax_prd_yr: number;
  filing_date?: string;
  tax_period_begin?: string;
  totrevenue?: number;
  totfuncexpns?: number;
  totprgmrevnue?: number;
  compnsatncurrofcr?: number;
  totassetsend?: number;
};

function mapFiling(raw: RawFiling): PropublicaFiling {
  return {
    tax_period: raw.tax_prd_yr,
    filing_date: raw.filing_date ?? raw.tax_period_begin ?? "",
    total_revenue: raw.totrevenue ?? 0,
    total_expenses: raw.totfuncexpns ?? 0,
    program_service_revenue: raw.totprgmrevnue ?? 0,
    executive_comp: raw.compnsatncurrofcr,
    total_assets: raw.totassetsend ?? 0,
  };
}
