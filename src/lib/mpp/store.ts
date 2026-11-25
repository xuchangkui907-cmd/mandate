import type { Address, Hex } from "viem";
import { getSql } from "../db";

export interface MppChallengeRecord {
  challengeId: string;
  memo: Hex;
  resource: string;
  mandateId: string;
  mandateBook: Address;
  chainId: number;
  token: Address;
  merchant: Address;
  amount: bigint;
  expectedSpender: Address;
  expiresAt: number;
}

export interface MppPaymentReceiptInput {
  challengeId: string;
  txHash: Hex;
  resource: string;
  mandateId: string;
  merchant: Address;
  amount: bigint;
  blockNumber: bigint;
  explorerUrl: string;
}

let lastCleanupAt = 0;
let cleanupInFlight: Promise<void> | null = null;

export async function cleanupExpiredMppRecords(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < 10 * 60 * 1000) return;
  if (cleanupInFlight) return cleanupInFlight;

  cleanupInFlight = (async () => {
    const sql = await getSql();
    await sql.query(
      `DELETE FROM mpp_rate_limits WHERE window_start < $1`,
      [now - 24 * 60 * 60 * 1000],
    );
    await sql.query(
      `DELETE FROM mpp_challenges c
       WHERE c.expires_at < $1
         AND NOT EXISTS (
           SELECT 1 FROM mpp_redeemed_transactions r
           WHERE r.challenge_id = c.challenge_id
         )`,
      [now],
    );
    lastCleanupAt = Date.now();
  })();

  try {
    await cleanupInFlight;
  } finally {
    cleanupInFlight = null;
  }
}

export async function saveChallenge(
  challenge: MppChallengeRecord,
): Promise<void> {
  await cleanupExpiredMppRecords().catch(() => undefined);
  const sql = await getSql();
  await sql.query(
    `INSERT INTO mpp_challenges (
       challenge_id, memo, resource, mandate_id, mandate_book, chain_id,
       token, merchant, amount, expected_spender, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (challenge_id) DO NOTHING`,
    [
      challenge.challengeId,
      challenge.memo,
      challenge.resource,
      challenge.mandateId,
      challenge.mandateBook,
      challenge.chainId,
      challenge.token,
      challenge.merchant,
      challenge.amount.toString(),
      challenge.expectedSpender,
      challenge.expiresAt,
    ],
  );
}

interface ChallengeRow {
  challenge_id: string;
  memo: string;
  resource: string;
  mandate_id: string;
  mandate_book: string;
  chain_id: number;
  token: string;
  merchant: string;
  amount: string;
  expected_spender: string;
  expires_at: number;
}

export async function findChallenge(
  challengeId: string,
): Promise<MppChallengeRecord | null> {
  const sql = await getSql();
  const rows = await sql.query<ChallengeRow>(
    `SELECT challenge_id, memo, resource, mandate_id, mandate_book,
            chain_id, token, merchant, amount, expected_spender, expires_at
     FROM mpp_challenges WHERE challenge_id = $1 LIMIT 1`,
    [challengeId],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    challengeId: row.challenge_id,
    memo: row.memo as Hex,
    resource: row.resource,
    mandateId: row.mandate_id,
    mandateBook: row.mandate_book as Address,
    chainId: Number(row.chain_id),
    token: row.token as Address,
    merchant: row.merchant as Address,
    amount: BigInt(row.amount),
    expectedSpender: row.expected_spender as Address,
    expiresAt: Number(row.expires_at),
  };
}

export async function isTxOrChallengeRedeemed(
  txHash: Hex,
  challengeId: string,
): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ found: boolean }>(
    `SELECT (
       EXISTS (SELECT 1 FROM mpp_redeemed_transactions WHERE tx_hash = $1)
       OR EXISTS (SELECT 1 FROM mpp_redeemed_transactions WHERE challenge_id = $2)
     ) AS found`,
    [txHash, challengeId],
  );
  return rows[0]?.found === true;
}

export async function atomicRedeemPayment(input: {
  txHash: Hex;
  challengeId: string;
  mandateId: string;
  blockNumber: bigint;
  spender: Address;
  amount: bigint;
  receipt: MppPaymentReceiptInput;
}): Promise<boolean> {
  const sql = await getSql();

  return sql.transaction(async (tx) => {
    const inserted = await tx.query<{ tx_hash: string }>(
      `INSERT INTO mpp_redeemed_transactions (
         tx_hash, challenge_id, mandate_id, block_number, spender, amount
       ) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING
       RETURNING tx_hash`,
      [
        input.txHash,
        input.challengeId,
        input.mandateId,
        input.blockNumber.toString(),
        input.spender,
        input.amount.toString(),
      ],
    );

    if (inserted.length === 0) return false;

    await tx.query(
      `INSERT INTO mpp_payment_receipts (
         challenge_id, tx_hash, resource, mandate_id, merchant, amount,
         block_number, explorer_url
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        input.receipt.challengeId,
        input.receipt.txHash,
        input.receipt.resource,
        input.receipt.mandateId,
        input.receipt.merchant,
        input.receipt.amount.toString(),
        input.receipt.blockNumber.toString(),
        input.receipt.explorerUrl,
      ],
    );

    return true;
  });
}

export async function checkSharedRateLimit(
  bucketKey: string,
  maxHits: number,
  windowMs: number,
): Promise<boolean> {
  const sql = await getSql();
  const now = Date.now();
  const rows = await sql.query<{ hit_count: number }>(
    `INSERT INTO mpp_rate_limits (bucket_key, window_start, hit_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (bucket_key) DO UPDATE SET
       window_start = CASE
         WHEN mpp_rate_limits.window_start + $3 <= $2 THEN $2
         ELSE mpp_rate_limits.window_start
       END,
       hit_count = CASE
         WHEN mpp_rate_limits.window_start + $3 <= $2 THEN 1
         ELSE mpp_rate_limits.hit_count + 1
       END
     RETURNING hit_count`,
    [bucketKey, now, windowMs],
  );

  return Number(rows[0]?.hit_count ?? maxHits + 1) <= maxHits;
}
