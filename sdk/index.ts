/**
 * Mandate SDK — ABI fragments, Tempo constants, and 6-decimal helpers.
 * No runtime dependencies. Calldata encoding is left to viem/ethers;
 * `encode*` returns the fragment plus args for the TS VM / a wallet client.
 */

export const TEMPO = {
  chainId: 4217,
  pathUSD: "0x20c0000000000000000000000000000000000000",
  factory: "0x20Fc000000000000000000000000000000000000",
  feeManager: "0xfeec000000000000000000000000000000000000",
} as const;

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type Mandate = {
  spender: Address;
  token: Address;
  spendMax: bigint;
  remaining: bigint;
  validAfter: bigint;
  validUntil: bigint;
  rateLimit: bigint;
  window: number;
  windowSpent: bigint;
  windowStart: bigint;
  paused: boolean;
  closed: boolean;
  department: Hex;
};

export type IssueParams = {
  spender: Address;
  token: Address;
  spendMax: bigint;
  validAfter: bigint;
  validUntil: bigint;
  rateLimit: bigint;
  window: number;
  department: Hex;
};

export type PayParams = {
  id: bigint;
  merchant: Address;
  amount: bigint;
  memo: Hex;
};

export type SetMerchantParams = {
  id: bigint;
  merchant: Address;
  allowed: boolean;
};

export const ISSUE_ABI = {
  type: "function",
  name: "issue",
  stateMutability: "nonpayable",
  inputs: [
    { name: "spender", type: "address" },
    { name: "token", type: "address" },
    { name: "spendMax", type: "uint128" },
    { name: "validAfter", type: "uint64" },
    { name: "validUntil", type: "uint64" },
    { name: "rateLimit", type: "uint128" },
    { name: "window", type: "uint32" },
    { name: "department", type: "bytes32" },
  ],
  outputs: [{ name: "id", type: "uint256" }],
} as const;

export const PAY_ABI = {
  type: "function",
  name: "pay",
  stateMutability: "nonpayable",
  inputs: [
    { name: "id", type: "uint256" },
    { name: "merchant", type: "address" },
    { name: "amount", type: "uint128" },
    { name: "memo", type: "bytes32" },
  ],
  outputs: [],
} as const;

export const SET_MERCHANT_ABI = {
  type: "function",
  name: "setMerchant",
  stateMutability: "nonpayable",
  inputs: [
    { name: "id", type: "uint256" },
    { name: "merchant", type: "address" },
    { name: "allowed", type: "bool" },
  ],
  outputs: [],
} as const;

export const SIGNATURES = {
  issue: "issue(address,address,uint128,uint64,uint64,uint128,uint32,bytes32)",
  pay: "pay(uint256,address,uint128,bytes32)",
  setMerchant: "setMerchant(uint256,address,bool)",
} as const;

export const REVERT_ERRORS = [
  "UnknownMandate",
  "NotOwner",
  "NotSpender",
  "MandatePaused",
  "MandateClosed",
  "MandateNotYetValid",
  "MandateExpired",
  "MerchantNotAllowed",
  "CapExceeded",
  "RateLimited",
  "InsufficientTreasury",
  "ZeroAmount",
  "InvalidWindow",
  "InvalidSpendMax",
] as const;

export type RevertError = (typeof REVERT_ERRORS)[number];

export function encodeIssue(p: IssueParams) {
  return {
    signature: SIGNATURES.issue,
    abi: ISSUE_ABI,
    args: [
      p.spender,
      p.token,
      p.spendMax,
      p.validAfter,
      p.validUntil,
      p.rateLimit,
      p.window,
      p.department,
    ] as const,
  };
}

export function encodePay(p: PayParams) {
  return {
    signature: SIGNATURES.pay,
    abi: PAY_ABI,
    args: [p.id, p.merchant, p.amount, p.memo] as const,
  };
}

export function encodeSetMerchant(p: SetMerchantParams) {
  return {
    signature: SIGNATURES.setMerchant,
    abi: SET_MERCHANT_ABI,
    args: [p.id, p.merchant, p.allowed] as const,
  };
}

const SCALE = 1_000_000n;

export function parseUnits6(value: string): bigint {
  const s = value.trim();
  if (!s || s.startsWith("-")) throw new Error("invalid amount");
  const parts = s.split(".");
  if (parts.length > 2) throw new Error("invalid amount");
  const whole = BigInt(parts[0] === "" ? "0" : parts[0]);
  const fracRaw = parts[1] ?? "";
  if (fracRaw.length > 6 && fracRaw.slice(6).replace(/0/g, "") !== "") {
    throw new Error("more than 6 decimals");
  }
  const frac = BigInt((fracRaw + "000000").slice(0, 6));
  return whole * SCALE + frac;
}

export function formatUnits6(amount: bigint): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  const body = frac.length === 0 ? `${whole}` : `${whole}.${frac}`;
  return neg ? `-${body}` : body;
}
