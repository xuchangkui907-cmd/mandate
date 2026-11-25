import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MPP_RESOURCES } from "../../../lib/tempo/constants";
import {
  TEMPO_MODERATO,
  challengeIdToMemo,
  formatUnits6,
} from "../../../../sdk/index";
import {
  checkSharedRateLimit,
  findChallenge,
  saveChallenge,
  type MppChallengeRecord,
} from "../../../lib/mpp/store";
import { verifyMppOnChainPayment } from "../../../lib/mpp/verifier";
import { parsePaymentAuthHeader } from "../../../lib/mpp/payment-auth";
import { matchesMppChallengeConfig } from "../../../lib/mpp/challenge-config";

function jsonNoStore(
  body: unknown,
  statusOrInit: number | ResponseInit = 200,
  headers?: HeadersInit
): Response {
  const init: ResponseInit =
    typeof statusOrInit === "number"
      ? { status: statusOrInit, headers }
      : statusOrInit;

  const responseHeaders = new Headers(init.headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("Pragma", "no-cache");

  return Response.json(body, {
    ...init,
    headers: responseHeaders,
  });
}

const RESOURCE_PAYLOADS: Record<string, Record<string, unknown>> = {
  helios: {
    signal: "SOL/USDC orderbook imbalance +2.4 sigma",
    confidence: 0.91,
    source: "Helios Live Feed",
  },
  atlas: {
    renderUrl: "https://cdn.verbodesk.com/renders/sample-frame.png",
    computeMs: 312,
  },
  shadow: {
    warning: "If you see this, fail-closed allowlist was bypassed!",
  },
};

function requireEnvAddress(name: string): Address {
  const val = process.env[name];
  if (!val || !/^0x[a-fA-F0-9]{40}$/.test(val)) {
    throw new Error(`Missing or invalid required env address: ${name}`);
  }
  return val as Address;
}

function getExpectedSpender(): Address {
  const relayerKey = process.env.DEMO_RELAYER_PRIVATE_KEY as Hex | undefined;
  if (!relayerKey) {
    throw new Error("Missing DEMO_RELAYER_PRIVATE_KEY");
  }
  const relayerAddress = privateKeyToAccount(relayerKey).address;
  const explicit = process.env.DEMO_SPENDER;
  if (explicit && explicit.toLowerCase() !== relayerAddress.toLowerCase()) {
    throw new Error(
      "DEMO_SPENDER env mismatch: must equal address derived from DEMO_RELAYER_PRIVATE_KEY"
    );
  }
  return relayerAddress;
}

function getTrustedClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return `mpp:ip:${realIp}`;
  return "mpp:global";
}

export async function handleMppResourceRequest(
  request: Request,
  resourceKey: string
): Promise<Response> {

const spec =
  MPP_RESOURCES[resourceKey as keyof typeof MPP_RESOURCES];

  if (!spec) {
    return jsonNoStore({ error: "Unknown MPP resource" }, { status: 404 });
  }

  // Shared limit applies to both challenge creation and payment verification.
  const allowed = await checkSharedRateLimit(
    `${getTrustedClientIp(request)}:${resourceKey}`,
    60,
    60_000
  );
  if (!allowed) {
    return jsonNoStore(
      { error: "MPP resource rate limit exceeded" },
      { status: 429 }
    );
  }

  const mandateBookAddress = requireEnvAddress("MANDATE_BOOK_ADDRESS");
  const merchant = requireEnvAddress(spec.merchantEnvKey);
  const expectedSpender = getExpectedSpender();
  const mandateId = process.env.DEMO_MANDATE_ID ?? "1";
  const amount = BigInt(spec.priceMicro);

  const authHeader = request.headers.get("authorization");
  const parsedAuth = parsePaymentAuthHeader(authHeader, resourceKey);

  if (parsedAuth.kind === "invalid") {
    return jsonNoStore(
      { error: "Invalid Payment Authorization header" },
      { status: 402, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (parsedAuth.kind === "none") {
    const newId = `mpp_${resourceKey}_${randomUUID().replace(/-/g, "").slice(0, 32)}`;
    const memo = challengeIdToMemo(newId);
    const challenge: MppChallengeRecord = {
      challengeId: newId,
      memo,
      resource: spec.id,
      mandateId,
      mandateBook: mandateBookAddress,
      chainId: TEMPO_MODERATO.chainId,
      token: TEMPO_MODERATO.pathUSD,
      merchant,
      amount,
      expectedSpender,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    await saveChallenge(challenge);

    const wwwAuth = [
      `Payment method="tempo"`,
      `chainId="${TEMPO_MODERATO.chainId}"`,
      `contract="${mandateBookAddress}"`,
      `mandateId="${mandateId}"`,
      `spender="${expectedSpender}"`,
      `token="${TEMPO_MODERATO.pathUSD}"`,
      `merchant="${merchant}"`,
      `amount="${amount.toString()}"`,
      `challengeId="${newId}"`,
      `memo="${memo}"`,
    ].join(", ");

    return jsonNoStore(
      {
        status: 402,
        error: "Payment Required",
        resource: spec.name,
        priceUsd: formatUnits6(amount),
        challenge: {
          challengeId: newId,
          memo,
          mandateId,
          expectedSpender,
          chainId: TEMPO_MODERATO.chainId,
          contract: mandateBookAddress,
          token: TEMPO_MODERATO.pathUSD,
          merchant,
          amount: amount.toString(),
        },
      },
      {
        status: 402,
        headers: {
          "WWW-Authenticate": wwwAuth,
          "Cache-Control": "no-store",
        },
      }
    );
  }

  if (parsedAuth.kind !== "payment") {
    return jsonNoStore(
      { error: "Invalid Payment Authorization state" },
      { status: 402, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { txHash, challengeId } = parsedAuth;
  const challenge = await findChallenge(challengeId);
  if (
    !challenge ||
    !matchesMppChallengeConfig(challenge, {
      resource: spec.id,
      mandateId,
      mandateBook: mandateBookAddress,
      chainId: TEMPO_MODERATO.chainId,
      token: TEMPO_MODERATO.pathUSD,
      merchant,
      amount,
      expectedSpender,
    })
  ) {
    return jsonNoStore(
      { error: "Unknown, mismatched, or unauthorized challengeId" },
      { status: 402 }
    );
  }

  const verification = await verifyMppOnChainPayment({
    txHash,
    challenge,
    mandateBookAddress,
    rpcUrl: process.env.TEMPO_MODERATO_RPC ?? TEMPO_MODERATO.rpcUrl,
  });

  if (!verification.ok) {
    return jsonNoStore(
      {
        error: "Payment verification failed",
        reason: verification.reason,
      },
      { status: 402 }
    );
  }

  const receiptHeader = `method="tempo", chainId="${TEMPO_MODERATO.chainId}", txHash="${txHash}", blockNumber="${verification.blockNumber}", challengeId="${challengeId}"`;

  return jsonNoStore(
    {
      status: 200,
      resource: spec.name,
      data: RESOURCE_PAYLOADS[spec.id],
      settlement: verification,
    },
    {
      status: 200,
      headers: {
        "Payment-Receipt": receiptHeader,
        "Cache-Control": "no-store",
      },
    }
  );
}

export const Route = createFileRoute("/api/mpp/$resource")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        return handleMppResourceRequest(request, params.resource);
      },
    },
  },
});
