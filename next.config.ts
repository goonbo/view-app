import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle fixture JSON into serverless functions. The adapters under
  // `lib/{propublica,charity-navigator,llm}/fixture.ts` read these via
  // fs.readFile at runtime; without this hint, Next.js's bundler doesn't
  // know to include them and the deployed functions 500 on first read.
  outputFileTracingIncludes: {
    "/api/**": ["./src/lib/fixtures/**/*"],
  },
};

export default nextConfig;
