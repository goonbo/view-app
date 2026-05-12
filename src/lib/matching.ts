import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { donations, matchPolicies } from "@/db/schema";

export type MatchEvaluation = {
  matchAmount: number;
  matchPolicyId: string | null;
  /** Reason a 0 match was returned (logging only, not user-facing). */
  reason?:
    | "no_active_policy"
    | "partner_not_eligible"
    | "outside_window"
    | "employee_cap_hit"
    | "total_cap_hit";
};

type EvaluateArgs = {
  corporateWorkspaceId: string;
  partnerId: string;
  employeeEmail: string;
  amount: number;
  /** Used as the donation timestamp for window checks. Defaults to now. */
  at?: Date;
};

/**
 * Pick the best-fit active match policy for a donation, then compute the
 * match amount under that policy. Order of operations matches the spec:
 *
 *   1. Find active policies in this corporate workspace
 *   2. Filter to policies whose eligible_partner_ids includes the partner
 *   3. Filter to policies whose date window contains the donation
 *   4. Pick the first match (the spec is fine with a single applicable
 *      policy at this stage — multi-policy resolution is not in scope)
 *   5. Compute raw match = amount * ratio
 *   6. Apply per-employee cap (cumulative across this policy)
 *   7. Apply total program cap (cumulative across this policy)
 *
 * Returns matchAmount in dollars (rounded to cents) plus the chosen policy.
 */
export async function evaluateMatch(args: EvaluateArgs): Promise<MatchEvaluation> {
  const at = args.at ?? new Date();

  const candidates = await db
    .select()
    .from(matchPolicies)
    .where(
      and(
        eq(matchPolicies.corporateWorkspaceId, args.corporateWorkspaceId),
        eq(matchPolicies.status, "active"),
      ),
    );

  const eligible = candidates
    .filter((p) => (p.eligiblePartnerIds as string[]).includes(args.partnerId))
    .filter((p) => p.startsAt <= at && p.endsAt >= at);

  if (eligible.length === 0) {
    return {
      matchAmount: 0,
      matchPolicyId: null,
      reason:
        candidates.length === 0
          ? "no_active_policy"
          : candidates.some((p) => (p.eligiblePartnerIds as string[]).includes(args.partnerId))
            ? "outside_window"
            : "partner_not_eligible",
    };
  }

  const policy = eligible[0];
  const ratio = Number(policy.matchRatio);
  const capPerEmployee = Number(policy.capPerEmployee);
  const capTotal = policy.capTotal ? Number(policy.capTotal) : null;

  // Sum existing matches under this policy by this employee.
  const [employeeSum] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${donations.matchAmount}), 0)`,
    })
    .from(donations)
    .where(
      and(
        eq(donations.matchPolicyId, policy.id),
        eq(donations.employeeEmail, args.employeeEmail),
      ),
    );
  const employeeSoFar = Number(employeeSum.total ?? 0);
  const employeeRoom = Math.max(0, capPerEmployee - employeeSoFar);

  // Sum total matches under this policy.
  let totalRoom = Infinity;
  if (capTotal !== null) {
    const [totalSum] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${donations.matchAmount}), 0)`,
      })
      .from(donations)
      .where(eq(donations.matchPolicyId, policy.id));
    totalRoom = Math.max(0, capTotal - Number(totalSum.total ?? 0));
  }

  const desired = args.amount * ratio;
  const matchAmount = round2(Math.min(desired, employeeRoom, totalRoom));

  return {
    matchAmount,
    matchPolicyId: policy.id,
    reason:
      matchAmount === 0
        ? employeeRoom === 0
          ? "employee_cap_hit"
          : totalRoom === 0
            ? "total_cap_hit"
            : undefined
        : undefined,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
