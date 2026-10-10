import type { RevertName } from "./constants";

export type Address = `0x${string}`;
export type Bytes32 = `0x${string}`;
export type Hash = `0x${string}`;

export type Lane = "payment" | "general";

export type MandateStatus = "active" | "paused" | "closed" | "expired";

export interface Mandate {
  id: number;
  spender: Address;
  spenderLabel: string;
  token: Address;
  spendMax: number;
  remaining: number;
  validAfter: number;
  validUntil: number;
  rateLimit: number;
  window: number;
  windowSpent: number;
  windowStart: number;
  paused: boolean;
  closed: boolean;
  department: string;
  issuedAt: number;
  allowlist: Address[];
}

export interface Receipt {
  id: string;
  mandateId: number;
  merchant: Address;
  merchantName: string;
  origin: string;
  amount: number;
  memo: Bytes32;
  challengeId: string;
  txHash: Hash;
  blockNumber: number;
  feeMicro: number;
  lane: Lane;
  department: string;
  timestamp: number;
  status: "settled" | "reverted";
  revert?: RevertName;
  body?: string | null;
}

export interface TraceLine {
  id: string;
  kind: "http" | "chain" | "note" | "error" | "ok";
  title: string;
  detail?: string;
  timestamp: number;
}

export interface Block {
  number: number;
  timestamp: number;
  txHash: Hash;
  lane: Lane;
  from: Address;
  to: Address;
  summary: string;
  feeMicro: number;
  status: "success" | "revert";
  revert?: RevertName;
}

export interface MppChallenge {
  id: string;
  method: "tempo";
  amount: number;
  currency: "USD";
  token: Address;
  recipient: Address;
  network: "tempo";
  chainId: number;
  expires: number;
  resource: string;
}

export interface MppCredential {
  challengeId: string;
  method: "tempo";
  txHash: Hash;
  mandateId: number;
}

export type PayResult =
  | { ok: true; receipt: Receipt; challenge: MppChallenge }
  | { ok: false; revert: RevertName; trace: TraceLine[]; challenge?: MppChallenge };
