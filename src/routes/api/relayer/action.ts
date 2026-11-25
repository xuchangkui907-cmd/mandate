import { createFileRoute } from "@tanstack/react-router";
import { createWalletClient, http, parseEventLogs, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MPP_RESOURCES } from "../../../lib/tempo/constants";
import {
  MANDATE_BOOK_ABI,
  TEMPO_MODERATO,
  createModeratoPublicClient,
  extractMandateRevertName,
  tempoModeratoChain,
  txExplorerUrl,
} from "../../../../sdk/index";
import { checkSharedRateLimit, findChallenge } from "../../../lib/mpp/store";
import { authorizeRelayerRequest, isValidRelayerChallengeId } from "../../../lib/mpp/relayer-auth";
import {
  matchesConfiguredAmount,
  matchesConfiguredMerchant,
} from "../../../lib/mpp/challenge-config";

const inFlightRelayerChallenges = new Set<string>();

function jsonNoStore(
  body: unknown,
  statusOrInit: number | ResponseInit = 200
): Response {
  const init: ResponseInit =
    typeof statusOrInit === "number"
      ? { status: statusOrInit }
      : statusOrInit;

  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");

  return Response.json(body, {
    ...init,
    headers,
  });
}

function requireEnvAddress(name: string): Address {
  const val = process.env[name];
  if (!val || !/^0x[a-fA-F0-9]{40}$/.test(val)) {
    throw new Error(`Missing or invalid required env address: ${name}`);
  }
  return val as Address;
}

function getTrustedClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp ? `relayer:ip:${realIp}` : "relayer:global";
}

function getConfig() {
  const contractAddress = requireEnvAddress("MANDATE_BOOK_ADDRESS");
  const relayerKey = process.env.DEMO_RELAYER_PRIVATE_KEY as Hex | undefined;
  const rpcUrl = process.env.TEMPO_MODERATO_RPC ?? TEMPO_MODERATO.rpcUrl;
  const demoMandateId = BigInt(process.env.DEMO_MANDATE_ID ?? "1");
  return { contractAddress, relayerKey, rpcUrl, demoMandateId };
}

async function assertModeratoChain(
  publicClient: ReturnType<typeof createModeratoPublicClient>
) {
  const chainId = await publicClient.getChainId();
  if (chainId !== TEMPO_MODERATO.chainId) {
    throw new Error(
      `Wrong RPC chain: expected ${TEMPO_MODERATO.chainId}, got ${chainId}`
    );
  }
}

export async function handleLiveState() {
  const { contractAddress, rpcUrl, demoMandateId } = getConfig();
  const publicClient = createModeratoPublicClient(rpcUrl);
  await assertModeratoChain(publicClient);

  const [blockNumber, unencumbered, reserved, mandateTuple, allowCount] =
    await Promise.all([
      publicClient.getBlockNumber(),
      publicClient.readContract({
        address: contractAddress,
        abi: MANDATE_BOOK_ABI,
        functionName: "unencumberedBalance",
        args: [TEMPO_MODERATO.pathUSD],
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: MANDATE_BOOK_ABI,
        functionName: "reservedByToken",
        args: [TEMPO_MODERATO.pathUSD],
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: MANDATE_BOOK_ABI,
        functionName: "mandates",
        args: [demoMandateId],
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: MANDATE_BOOK_ABI,
        functionName: "allowlistCount",
        args: [demoMandateId],
      }),
    ]);

  return {
    chainId: TEMPO_MODERATO.chainId,
    contractAddress,
    blockNumber: blockNumber.toString(),
    unencumberedBalance: unencumbered.toString(),
    reservedByToken: reserved.toString(),
    allowlistCount: allowCount.toString(),
    mandate: {
      id: demoMandateId.toString(),
      spender: mandateTuple[0],
      token: mandateTuple[1],
      spendMax: mandateTuple[2].toString(),
      remaining: mandateTuple[3].toString(),
      maxPerTx: mandateTuple[4].toString(),
      validAfter: mandateTuple[5].toString(),
      validUntil: mandateTuple[6].toString(),
      rateLimit: mandateTuple[7].toString(),
      window: mandateTuple[8],
      windowSpent: mandateTuple[9].toString(),
      windowStart: mandateTuple[10].toString(),
      paused: mandateTuple[11],
      closed: mandateTuple[12],
      department: mandateTuple[13],
    },
  };
}

async function executeRelayerPayChallenge(challengeId: string) {
  const { contractAddress, relayerKey, rpcUrl, demoMandateId } = getConfig();
  if (!relayerKey) {
    throw new Error("DEMO_RELAYER_PRIVATE_KEY is not configured");
  }

  const account = privateKeyToAccount(relayerKey);
  const challenge = await findChallenge(challengeId);

  if (!challenge) {
    return { ok: false, status: 404, error: "Challenge not found" };
  }
  if (Date.now() >= challenge.expiresAt) {
    return { ok: false, status: 400, error: "Challenge expired" };
  }
  if (BigInt(challenge.mandateId) !== demoMandateId) {
    return {
      ok: false,
      status: 403,
      error: "Demo Relayer is restricted to DEMO_MANDATE_ID only",
    };
  }
  if (challenge.chainId !== TEMPO_MODERATO.chainId) {
    return {
      ok: false,
      status: 400,
      error: `Challenge chainId mismatch: expected ${TEMPO_MODERATO.chainId}`,
    };
  }
  if (challenge.mandateBook.toLowerCase() !== contractAddress.toLowerCase()) {
    return {
      ok: false,
      status: 400,
      error: "Challenge mandateBook does not match deployed contract",
    };
  }
  if (challenge.token.toLowerCase() !== TEMPO_MODERATO.pathUSD.toLowerCase()) {
    return {
      ok: false,
      status: 400,
      error: "Challenge token must be Moderato pathUSD",
    };
  }
  if (challenge.expectedSpender.toLowerCase() !== account.address.toLowerCase()) {
    return {
      ok: false,
      status: 403,
      error: "Challenge expectedSpender does not match Relayer account",
    };
  }

  const resourceSpec =
    MPP_RESOURCES[
      challenge.resource as keyof typeof MPP_RESOURCES
    ];

  if (!resourceSpec) {
    return {
      ok: false,
      status: 400,
      error: "Unsupported challenge resource",
    };
  }

  const expectedMerchant = requireEnvAddress(resourceSpec.merchantEnvKey);
  if (!matchesConfiguredMerchant(challenge.merchant, expectedMerchant)) {
    return {
      ok: false,
      status: 400,
      error: "Challenge merchant does not match configured resource merchant",
    };
  }

  const expectedAmount = BigInt(resourceSpec.priceMicro);
  if (!matchesConfiguredAmount(challenge.amount, expectedAmount)) {
    return {
      ok: false,
      status: 400,
      error: "Challenge amount does not match configured resource price",
    };
  }

  const publicClient = createModeratoPublicClient(rpcUrl);
  await assertModeratoChain(publicClient);

  const walletClient = createWalletClient({
    account,
    chain: tempoModeratoChain,
    transport: http(rpcUrl),
  });

  let txHash: Hex | undefined;

  try {
    const alreadySettled = await publicClient.readContract({
      address: contractAddress,
      abi: MANDATE_BOOK_ABI,
      functionName: "settledMemos",
      args: [demoMandateId, challenge.memo],
    });

    if (alreadySettled) {
      return {
        ok: false,
        status: 409,
        error: "Challenge already settled; refusing duplicate payment",
      };
    }

    await publicClient.simulateContract({
      account,
      address: contractAddress,
      abi: MANDATE_BOOK_ABI,
      functionName: "pay",
      args: [demoMandateId, challenge.merchant, challenge.amount, challenge.memo],
    });

    txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: MANDATE_BOOK_ABI,
      functionName: "pay",
      args: [demoMandateId, challenge.merchant, challenge.amount, challenge.memo],
    });

    const explorerUrl = txExplorerUrl(txHash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      return {
        ok: false,
        status: 502,
        reverted: true,
        outcome: "reverted",
        error: "On-chain payment transaction reverted",
        txHash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        explorerUrl,
      };
    }

    const paidLogs = parseEventLogs({
      abi: MANDATE_BOOK_ABI,
      eventName: "Paid",
      logs: receipt.logs.filter(
        (log) => log.address.toLowerCase() === contractAddress.toLowerCase()
      ),
    });

    const matched = paidLogs.find((log) => {
      const args = log.args;
      if (!args) return false;
      if (args.id !== demoMandateId) return false;
      if (args.spender.toLowerCase() !== account.address.toLowerCase()) return false;
      if (args.merchant.toLowerCase() !== challenge.merchant.toLowerCase()) return false;
      if (args.token.toLowerCase() !== challenge.token.toLowerCase()) return false;
      if (args.amount !== challenge.amount) return false;
      if (args.memo.toLowerCase() !== challenge.memo.toLowerCase()) return false;
      return true;
    });

    if (!matched || !matched.args) {
      return {
        ok: false,
        status: 502,
        reverted: false,
        outcome: "verification_failed",
        verificationFailed: true,
        error: "Transaction succeeded but no matching MandateBook.Paid event was found",
        txHash,
        blockNumber: receipt.blockNumber.toString(),
        explorerUrl,
      };
    }

    const settled = await publicClient.readContract({
      address: contractAddress,
      abi: MANDATE_BOOK_ABI,
      functionName: "settledMemos",
      args: [demoMandateId, challenge.memo],
    });

    if (!settled) {
      return {
        ok: false,
        status: 502,
        reverted: false,
        outcome: "verification_failed",
        verificationFailed: true,
        error: "Paid event matched but settledMemos verification returned false",
        txHash,
        blockNumber: receipt.blockNumber.toString(),
        explorerUrl,
      };
    }

    return {
      ok: true,
      status: 200,
      reverted: false,
      outcome: "confirmed",
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl,
      mandateId: matched.args.id.toString(),
      spender: matched.args.spender,
      merchant: matched.args.merchant,
      token: matched.args.token,
      amount: matched.args.amount.toString(),
      memo: matched.args.memo,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const revertName = extractMandateRevertName(err);

    if (txHash) {
      return {
        ok: false,
        status: 202,
        reverted: false,
        pending: true,
        outcome: "unknown",
        error: "Transaction was broadcast, but confirmation or verification is unavailable. Check the transaction before retrying.",
        message,
        txHash,
        explorerUrl: txExplorerUrl(txHash),
      };
    }

    if (revertName) {
      return {
        ok: false,
        status: 400,
        reverted: true,
        outcome: "reverted",
        revertError: revertName,
        message,
      };
    }

    return {
      ok: false,
      status: 503,
      reverted: false,
      pending: false,
      outcome: "unknown",
      error: "Relayer could not determine whether the transaction was submitted. Check on-chain state before retrying.",
      message,
    };
  }
}

export async function handleRelayerPayChallenge(challengeId: string) {
  if (inFlightRelayerChallenges.has(challengeId)) {
    return {
      ok: false,
      status: 409,
      error: "Challenge payment is already in progress",
    };
  }

  inFlightRelayerChallenges.add(challengeId);

  try {
    return await executeRelayerPayChallenge(challengeId);
  } finally {
    inFlightRelayerChallenges.delete(challengeId);
  }
}

export const Route = createFileRoute("/api/relayer/action")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authError = authorizeRelayerRequest(request);
        if (authError) return authError;

        try {
          const state = await handleLiveState();
          return jsonNoStore(state);
        } catch (err) {
          console.error("[relayer/action] GET failed:", err);
          return jsonNoStore(
            { error: "Unable to retrieve relayer state" },
            { status: 503 }
          );
        }
      },
      POST: async ({ request }) => {
        const authError = authorizeRelayerRequest(request);
        if (authError) return authError;

        try {
          const bucket = getTrustedClientIp(request);
          const allowed = await checkSharedRateLimit(bucket, 20, 60_000);
          if (!allowed) {
            return jsonNoStore({ error: "Rate limit exceeded" }, { status: 429 });
          }

          const body: unknown = await request.json().catch(() => null);

          if (!body || typeof body !== "object" || Array.isArray(body)) {
            return jsonNoStore(
              { error: "Invalid request body" },
              { status: 400 }
            );
          }

          const payload = body as {
            action?: unknown;
            challengeId?: unknown;
          };

          if (
            payload.action !== "pay_challenge" ||
            !isValidRelayerChallengeId(payload.challengeId)
          ) {
            return jsonNoStore(
              { error: "Invalid request: expected pay_challenge and a valid challengeId" },
              { status: 400 }
            );
          }

          const result = await handleRelayerPayChallenge(payload.challengeId);
          return jsonNoStore(result, { status: result.status ?? 200 });
        } catch (err) {
          console.error("[relayer/action] POST failed:", err);
          return jsonNoStore(
            { error: "Relayer action failed; check server logs" },
            { status: 503 }
          );
        }
      },
    },
  },
});
