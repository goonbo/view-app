export type DataMode = "fixture" | "live";

/**
 * Reads DATA_MODE env. Default is "fixture" — never accidentally cost money
 * by falling back to live API calls.
 */
export function getDataMode(): DataMode {
  const mode = process.env.DATA_MODE;
  if (mode === "live") return "live";
  return "fixture";
}

export function isCapturingFixtures(): boolean {
  return process.env.CAPTURE_FIXTURES === "true" && getDataMode() === "live";
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}
