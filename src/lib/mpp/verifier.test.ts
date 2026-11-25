import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics, type Address, type Hex } from "viem";
import {
  MANDATE_BOOK_ABI,
  TEMPO_MODERATO,
  challengeIdToMemo,
  txExplorerUrl,
} from "../../../sdk/index.ts";
import {
  verifyMppOnChainPayment,
  type VerifyPaymentDependencies,
} from "./verifier.ts";
import type { MppChallengeRecord } from "./store";

const BOOK = "0x1111111111111111111111111111111111111111" as Address;
const TOKEN = "0x2222222222222222222222222222222222222222" as Address;
const MERCHANT = "0x3333333333333333333333333333333333333333" as Address;
const SPENDER = "0x4444444444444444444444444444444444444444" as Address;
const TX = `0x${"a".repeat(64)}` as Hex;
const CHALLENGE_ID = `mpp_helios_${"a".repeat(32)}`;
const NOW = 1_800_000_000_000;

function challenge(overrides: Partial<MppChallengeRecord> = {}): MppChallengeRecord {
  return {
    challengeId: CHALLENGE_ID,
    memo: challengeIdToMemo(CHALLENGE_ID),
    resource: "helios",
    mandateId: "1",
    mandateBook: BOOK,
    chainId: TEMPO_MODERATO.chainId,
    token: TOKEN,
    merchant: MERCHANT,
    amount: 400_000n,
    expectedSpender: SPENDER,
    expiresAt: NOW + 300_000,
    ...overrides,
  };
}

function dependencies(overrides: Partial<VerifyPaymentDependencies> = {}) {
  let redeemedChecks = 0;
  let clientCreations = 0;
  let commits = 0;

  const deps: VerifyPaymentDependencies = {
    isRedeemed: async (txHash, challengeId) => {
      redeemedChecks++;
      return overrides.isRedeemed
        ? overrides.isRedeemed(txHash, challengeId)
        : false;
    },
    commit: async (input) => {
      commits++;
      return overrides.commit ? overrides.commit(input) : true;
    },
    createClient: overrides.createClient ?? ((() => {
      clientCreations++;
      return {
        getChainId: async () => TEMPO_MODERATO.chainId,
      } as never;
    }) as unknown as VerifyPaymentDependencies["createClient"]),
    now: overrides.now ?? (() => NOW),
  };

  return {
    deps,
    counts: () => ({ redeemedChecks, clientCreations, commits }),
  };
}

test("rejects a challenge for the wrong chain before DB or RPC", async () => {
  const d = dependencies();
  const result = await verifyMppOnChainPayment(
    { txHash: TX, challenge: challenge({ chainId: 1 }), mandateBookAddress: BOOK },
    d.deps,
  );
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /chainId mismatch/i);
  assert.deepEqual(d.counts(), { redeemedChecks: 0, clientCreations: 0, commits: 0 });
});

test("rejects a challenge bound to another MandateBook before DB or RPC", async () => {
  const d = dependencies();
  const result = await verifyMppOnChainPayment(
    {
      txHash: TX,
      challenge: challenge({ mandateBook: TOKEN }),
      mandateBookAddress: BOOK,
    },
    d.deps,
  );
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /mandateBook address mismatch/i);
  assert.equal(d.counts().redeemedChecks, 0);
});

test("rejects a challenge whose memo is not bound to its challenge ID", async () => {
  const d = dependencies();
  const result = await verifyMppOnChainPayment(
    {
      txHash: TX,
      challenge: challenge({ memo: `0x${"0".repeat(64)}` as Hex }),
      mandateBookAddress: BOOK,
    },
    d.deps,
  );
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /memo binding mismatch/i);
  assert.equal(d.counts().redeemedChecks, 0);
});

test("rejects an expired challenge", async () => {
  const d = dependencies({ now: () => NOW });
  const result = await verifyMppOnChainPayment(
    {
      txHash: TX,
      challenge: challenge({ expiresAt: NOW - 1 }),
      mandateBookAddress: BOOK,
    },
    d.deps,
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "Challenge expired");
  assert.equal(d.counts().redeemedChecks, 0);
});

test("rejects at the exact expiry millisecond (same boundary as Relayer)", async () => {
  const d = dependencies({ now: () => NOW });
  const result = await verifyMppOnChainPayment(
    {
      txHash: TX,
      challenge: challenge({ expiresAt: NOW }),
      mandateBookAddress: BOOK,
    },
    d.deps,
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "Challenge expired");
  assert.equal(d.counts().redeemedChecks, 0);
});

test("rejects an already redeemed transaction or challenge before RPC", async () => {
  const d = dependencies({
    isRedeemed: async () => true,
  });
  const result = await verifyMppOnChainPayment(
    { txHash: TX, challenge: challenge(), mandateBookAddress: BOOK },
    d.deps,
  );
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /Replay rejected/i);
  assert.deepEqual(d.counts(), { redeemedChecks: 1, clientCreations: 0, commits: 0 });
});

test("rejects an RPC connected to the wrong chain", async () => {
  const d = dependencies({
    createClient: (() => ({
      getChainId: async () => 1,
    })) as unknown as VerifyPaymentDependencies["createClient"],
  });
  const result = await verifyMppOnChainPayment(
    { txHash: TX, challenge: challenge(), mandateBookAddress: BOOK },
    d.deps,
  );
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /RPC chain mismatch/i);
  assert.equal(d.counts().commits, 0);
});


function paidLog(overrides: {
  id?: bigint;
  spender?: Address;
  merchant?: Address;
  token?: Address;
  amount?: bigint;
  memo?: Hex;
} = {}) {
  const topics = encodeEventTopics({
    abi: MANDATE_BOOK_ABI,
    eventName: "Paid",
    args: {
      id: overrides.id ?? 1n,
      spender: overrides.spender ?? SPENDER,
      merchant: overrides.merchant ?? MERCHANT,
    },
  });

  const data = encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint128" },
      { type: "bytes32" },
      { type: "uint128" },
    ],
    [
      overrides.token ?? TOKEN,
      overrides.amount ?? 400_000n,
      overrides.memo ?? challengeIdToMemo(CHALLENGE_ID),
      600_000n,
    ],
  );

  return {
    address: BOOK,
    topics,
    data,
  };
}

function chainDependencies(options: {
  status?: "success" | "reverted";
  logs?: ReturnType<typeof paidLog>[];
  settled?: boolean;
  commitResult?: boolean;
} = {}) {
  const receipt = {
    status: options.status ?? "success",
    blockNumber: 123n,
    logs: options.logs ?? [paidLog()],
  };

  let readContractCalls = 0;
  let commitInput: Parameters<VerifyPaymentDependencies["commit"]>[0] | undefined;

  const client = {
    getChainId: async () => TEMPO_MODERATO.chainId,
    getTransactionReceipt: async () => receipt,
    readContract: async () => {
      readContractCalls++;
      return options.settled ?? true;
    },
  };

  const d = dependencies({
    createClient: (() => client) as unknown as VerifyPaymentDependencies["createClient"],
    commit: async (input) => {
      commitInput = input;
      return options.commitResult ?? true;
    },
  });

  return {
    deps: d.deps,
    counts: d.counts,
    readCalls: () => readContractCalls,
    committedInput: () => commitInput,
  };
}

test("rejects a reverted on-chain transaction receipt", async () => {
  const d = chainDependencies({ status: "reverted" });

  const result = await verifyMppOnChainPayment(
    { txHash: TX, challenge: challenge(), mandateBookAddress: BOOK },
    d.deps,
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "On-chain transaction reverted or failed");
  assert.equal(d.readCalls(), 0);
  assert.equal(d.counts().commits, 0);
});

test("rejects a receipt without a MandateBook Paid event", async () => {
  const d = chainDependencies({ logs: [] });

  const result = await verifyMppOnChainPayment(
    { txHash: TX, challenge: challenge(), mandateBookAddress: BOOK },
    d.deps,
  );

  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /No MandateBook\.Paid event/i);
  assert.equal(d.readCalls(), 0);
  assert.equal(d.committedInput(), undefined);
});

const mismatchCases: Array<{
  name: string;
  log: ReturnType<typeof paidLog>;
}> = [
  { name: "mandateId", log: paidLog({ id: 2n }) },
  { name: "spender", log: paidLog({ spender: TOKEN }) },
  { name: "merchant", log: paidLog({ merchant: TOKEN }) },
  { name: "token", log: paidLog({ token: MERCHANT }) },
  { name: "exact amount", log: paidLog({ amount: 400_001n }) },
  { name: "memo", log: paidLog({ memo: `0x${"0".repeat(64)}` as Hex }) },
];

for (const mismatch of mismatchCases) {
  test(`rejects a Paid event with mismatched ${mismatch.name}`, async () => {
    const d = chainDependencies({ logs: [mismatch.log] });

    const result = await verifyMppOnChainPayment(
      { txHash: TX, challenge: challenge(), mandateBookAddress: BOOK },
      d.deps,
    );

    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /Paid event does not match challenge/i);
    assert.equal(d.readCalls(), 0);
    assert.equal(d.committedInput(), undefined);
  });
}

test("rejects when settledMemos is false", async () => {
  const d = chainDependencies({ settled: false });

  const result = await verifyMppOnChainPayment(
    { txHash: TX, challenge: challenge(), mandateBookAddress: BOOK },
    d.deps,
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "Contract settledMemos check returned false");
  assert.equal(d.readCalls(), 1);
  assert.equal(d.committedInput(), undefined);
});

test("rejects when the atomic DB commit reports a concurrent replay", async () => {
  const d = chainDependencies({ commitResult: false });

  const result = await verifyMppOnChainPayment(
    { txHash: TX, challenge: challenge(), mandateBookAddress: BOOK },
    d.deps,
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.reason,
    "Concurrent replay rejected during atomic DB commit",
  );
  assert.equal(d.readCalls(), 1);
  assert.ok(d.committedInput());
});

test("accepts a fully matching Paid event and atomically commits its receipt", async () => {
  const d = chainDependencies();

  const result = await verifyMppOnChainPayment(
    { txHash: TX, challenge: challenge(), mandateBookAddress: BOOK },
    d.deps,
  );

  assert.equal(result.ok, true);
  assert.equal(result.blockNumber, "123");
  assert.equal(result.txHash, TX);
  assert.equal(result.explorerUrl, txExplorerUrl(TX));
  assert.equal(result.mandateId, "1");
  assert.equal(result.amount, "400000");
  assert.equal(result.spender, SPENDER);

  assert.equal(d.readCalls(), 1);

  const committed = d.committedInput();
  assert.ok(committed);
  assert.equal(committed.txHash, TX);
  assert.equal(committed.challengeId, CHALLENGE_ID);
  assert.equal(committed.mandateId, "1");
  assert.equal(committed.blockNumber, 123n);
  assert.equal(committed.spender, SPENDER);
  assert.equal(committed.amount, 400_000n);

  assert.equal(committed.receipt.challengeId, CHALLENGE_ID);
  assert.equal(committed.receipt.txHash, TX);
  assert.equal(committed.receipt.resource, "helios");
  assert.equal(committed.receipt.mandateId, "1");
  assert.equal(committed.receipt.merchant, MERCHANT);
  assert.equal(committed.receipt.amount, 400_000n);
  assert.equal(committed.receipt.blockNumber, 123n);
  assert.equal(committed.receipt.explorerUrl, txExplorerUrl(TX));
});
