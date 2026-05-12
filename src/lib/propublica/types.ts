export type PropublicaSearchResult = {
  ein: string;
  legal_name: string;
  common_name?: string;
  location?: string;
  ntee_classification?: string;
  city?: string;
  state?: string;
};

export type PropublicaFiling = {
  tax_period: number;
  filing_date: string;
  total_revenue: number;
  total_expenses: number;
  /** From IRS 990 `totprgmrevnue` — program service revenue, not program expenses. */
  program_service_revenue: number;
  executive_comp?: number;
  total_assets: number;
};

export type PropublicaOrganization = {
  ein: string;
  legal_name: string;
  common_name?: string;
  address?: string;
  city?: string;
  state?: string;
  ntee_classification?: string;
  ruling_date?: string;
  mission?: string;
  website?: string;
  total_assets?: number;
  filings: PropublicaFiling[];
};

export interface PropublicaAdapter {
  search(query: string): Promise<PropublicaSearchResult[]>;
  getOrganization(ein: string): Promise<PropublicaOrganization>;
}
