import type { Hex } from "viem";

export type MppResourceKey = "helios" | "atlas" | "shadow";

export type ParsedPaymentAuth =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "payment"; txHash: Hex; challengeId: string };

export function parsePaymentAuthHeader(
  header: string | null,
  resourceKey: string,
): ParsedPaymentAuth {
  if (header === null) return { kind: "none" };

  if (!["helios", "atlas", "shadow"].includes(resourceKey)) {
    return { kind: "invalid" };
  }

  const prefix = /^Payment\s+/i;
  if (!prefix.test(header)) return { kind: "invalid" };

  const body = header.replace(prefix, "");
  if (!body.trim()) return { kind: "invalid" };

  const params = new Map<string, string>();

  for (const part of body.split(",")) {
    const match = /^\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(?:"([^"]*)"|([^\s,]+))\s*$/.exec(part);

    if (!match) return { kind: "invalid" };

    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3];

    if (params.has(key)) return { kind: "invalid" };
    params.set(key, value);
  }

  if ((params.get("method") ?? "").toLowerCase() !== "tempo") {
    return { kind: "invalid" };
  }

  const txHash = params.get("txhash");
  const challengeId = params.get("challengeid");

  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { kind: "invalid" };
  }

  const expectedChallengePattern =
    new RegExp(`^mpp_${resourceKey}_[a-f0-9]{32}$`);

  if (!challengeId || !expectedChallengePattern.test(challengeId)) {
    return { kind: "invalid" };
  }

  return {
    kind: "payment",
    txHash: txHash as Hex,
    challengeId,
  };
}
