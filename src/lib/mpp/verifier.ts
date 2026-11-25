import { parseEventLogs, type Address, type Hex } from "viem";
import {
  MANDATE_BOOK_ABI,
  TEMPO_MODERATO,
  challengeIdToMemo,
  createModeratoPublicClient,
  txExplorerUrl,
} from "../../../sdk/index.ts";
import type { MppChallengeRecord } from "./store.ts";

export interface VerifyPaymentInput {
  txHash: Hex;
  challenge: MppChallengeRecord;
  mandateBookAddress: Address;
  rpcUrl?: string;
}

export interface VerifyPaymentResult {
  ok: boolean;
  reason?: string;
  blockNumber?: string;
  txHash?: Hex;
  explorerUrl?: string;
  mandateId?: string;
  amount?: string;
  spender?: Address;
}

export interface VerifyPaymentDependencies {
  isRedeemed: (txHash: Hex, challengeId: string) => Promise<boolean>;
  commit: (input: {
    txHash: Hex;
    challengeId: string;
    mandateId: string;
    blockNumber: bigint;
    spender: Address;
    amount: bigint;
    receipt: {
      challengeId: string;
      txHash: Hex;
      resource: string;
      mandateId: string;
      merchant: Address;
      amount: bigint;
      blockNumber: bigint;
      explorerUrl: string;
    };
  }) => Promise<boolean>;
  createClient: typeof createModeratoPublicClient;
  now: () => number;
}

// Lazy-load persistence only when the production defaults are actually used.
// Unit tests can inject mocks without loading the DB adapter or its dependencies.
const DEFAULT_VERIFIER_DEPENDENCIES: VerifyPaymentDependencies = {
  isRedeemed: async (txHash, challengeId) => {
    const store = await import("./store.ts");
    return store.isTxOrChallengeRedeemed(txHash, challengeId);
  },
  commit: async (input) => {
    const store = await import("./store.ts");
    return store.atomicRedeemPayment(input);
  },
  createClient: createModeratoPublicClient,
  now: Date.now,
};

export async function verifyMppOnChainPayment(
  input: VerifyPaymentInput,
  dependencies: VerifyPaymentDependencies = DEFAULT_VERIFIER_DEPENDENCIES
): Promise<VerifyPaymentResult> {
  const { txHash, challenge, mandateBookAddress, rpcUrl } = input;

  // 1. Validate challenge integrity & binding
  if (challenge.chainId !== TEMPO_MODERATO.chainId) {
    return {
      ok: false,
      reason: `Challenge chainId mismatch: expected ${TEMPO_MODERATO.chainId}, got ${challenge.chainId}`,
    };
  }
  if (challenge.mandateBook.toLowerCase() !== mandateBookAddress.toLowerCase()) {
    return {
      ok: false,
      reason: "Challenge mandateBook address mismatch",
    };
  }
  const expectedMemo = challengeIdToMemo(challenge.challengeId);
  if (challenge.memo.toLowerCase() !== expectedMemo.toLowerCase()) {
    return {
      ok: false,
      reason: "Challenge memo binding mismatch",
    };
  }
  if (dependencies.now() >= challenge.expiresAt) {
    return { ok: false, reason: "Challenge expired" };
  }

  // 2. Fast pre-check against PostgreSQL anti-replay table
  const alreadyRedeemed = await dependencies.isRedeemed(
    txHash,
    challenge.challengeId
  );
  if (alreadyRedeemed) {
    return { ok: false, reason: "Replay rejected: txHash or challenge already redeemed" };
  }

  const client = dependencies.createClient(rpcUrl ?? TEMPO_MODERATO.rpcUrl);

  // 3. Verify RPC chain ID == 42431
  const chainId = await client.getChainId();
  if (chainId !== TEMPO_MODERATO.chainId) {
    return {
      ok: false,
      reason: `RPC chain mismatch: expected ${TEMPO_MODERATO.chainId}, got ${chainId}`,
    };
  }

  // 4. Fetch real transaction receipt
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    return { ok: false, reason: "On-chain transaction reverted or failed" };
  }

  // 5. Parse Paid(...) events emitted by our MandateBook contract
  const paidLogs = parseEventLogs({
    abi: MANDATE_BOOK_ABI,
    eventName: "Paid",
    logs: receipt.logs.filter(
      (l) => l.address.toLowerCase() === mandateBookAddress.toLowerCase()
    ),
  });

  if (paidLogs.length === 0) {
    return {
      ok: false,
      reason: "No MandateBook.Paid event found in transaction receipt",
    };
  }

  const expectedMandateId = BigInt(challenge.mandateId);

  const matched = paidLogs.find((log) => {
    const args = log.args;
    if (!args) return false;
    if (args.id !== expectedMandateId) return false;
    if (args.spender.toLowerCase() !== challenge.expectedSpender.toLowerCase()) {
      return false;
    }
    if (args.merchant.toLowerCase() !== challenge.merchant.toLowerCase()) return false;
    if (args.token.toLowerCase() !== challenge.token.toLowerCase()) return false;
    if (args.amount !== challenge.amount) return false;
    if (args.memo.toLowerCase() !== expectedMemo.toLowerCase()) return false;
    return true;
  });

  if (!matched || !matched.args) {
    return {
      ok: false,
      reason:
        "Paid event does not match challenge (mandateId, spender, merchant, token, exact amount, or memo)",
    };
  }

  // 6. Cross-check on-chain settledMemos(id, memo) == true
  const settledOnChain = await client.readContract({
    address: mandateBookAddress,
    abi: MANDATE_BOOK_ABI,
    functionName: "settledMemos",
    args: [matched.args.id, expectedMemo],
  });

  if (!settledOnChain) {
    return { ok: false, reason: "Contract settledMemos check returned false" };
  }

  // 7. Atomic PostgreSQL redemption (prevents concurrent double-spend race)
  const explorerUrl = txExplorerUrl(txHash);
  const committed = await dependencies.commit({
    txHash,
    challengeId: challenge.challengeId,
    mandateId: matched.args.id.toString(),
    blockNumber: receipt.blockNumber,
    spender: matched.args.spender,
    amount: matched.args.amount,
    receipt: {
      challengeId: challenge.challengeId,
      txHash,
      resource: challenge.resource,
      mandateId: matched.args.id.toString(),
      merchant: challenge.merchant,
      amount: matched.args.amount,
      blockNumber: receipt.blockNumber,
      explorerUrl,
    },
  });

  if (!committed) {
    return {
      ok: false,
      reason: "Concurrent replay rejected during atomic DB commit",
    };
  }

  return {
    ok: true,
    blockNumber: receipt.blockNumber.toString(),
    txHash,
    explorerUrl,
    mandateId: matched.args.id.toString(),
    amount: matched.args.amount.toString(),
    spender: matched.args.spender,
  };
}
