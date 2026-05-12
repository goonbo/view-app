/**
 * Smoke test for the adapter scaffolding. Run with `npx tsx src/lib/scripts/smoke.ts`.
 * Confirms DATA_MODE selection and that the fixture adapters return the right shape.
 */
import { propublica } from "../propublica";
import { charityNavigator } from "../charity-navigator";
import { getDataMode, isDemoMode } from "../data-mode";

async function main() {
  console.log(`DATA_MODE = ${getDataMode()}`);
  console.log(`DEMO_MODE = ${isDemoMode()}`);
  const searchResults = await propublica.search("food bank");
  console.log(`propublica.search("food bank") returned ${searchResults.length} results`);
  const rating = await charityNavigator.getRating("741640391");
  console.log(`charityNavigator.getRating("741640391") returned ${rating ? "rating" : "null"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
