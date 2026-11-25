import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  type Address,
  type Hex,
} from "viem";

export const TEMPO_MODERATO = {
  chainId: 42431,
  name: "Tempo Testnet (Moderato)",
  rpcUrl: "https://rpc.moderato.tempo.xyz",
  wsUrl: "wss://rpc.moderato.tempo.xyz",
  explorerUrl: "https://explore.testnet.tempo.xyz",
  pathUSD: "0x20c0000000000000000000000000000000000000" as Address,
  factory: "0x20Fc000000000000000000000000000000000000" as Address,
  feeManager: "0xfeec000000000000000000000000000000000000" as Address,
} as const;

export const tempoModeratoChain = defineChain({
  id: TEMPO_MODERATO.chainId,
  name: TEMPO_MODERATO.name,
  nativeCurrency: {
    name: "USD",
    symbol: "USD",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [TEMPO_MODERATO.rpcUrl],
      webSocket: [TEMPO_MODERATO.wsUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Tempo Testnet Explorer",
      url: TEMPO_MODERATO.explorerUrl,
    },
  },
  testnet: true,
});

export function createModeratoPublicClient(rpcUrl: string = TEMPO_MODERATO.rpcUrl) {
  return createPublicClient({
    chain: tempoModeratoChain,
    transport: http(rpcUrl),
  });
}

export const MANDATE_BOOK_ABI = parseAbi([
  "function owner() view returns (address)",
  "function treasuryAdmin() view returns (address)",
  "function emergencyGuardian() view returns (address)",
  "function policyOperators(address) view returns (bool)",
  "function nextId() view returns (uint256)",
  "function unencumberedBalance(address token) view returns (uint256)",
  "function reservedByToken(address token) view returns (uint256)",
  "function allowlisted(uint256 id, address merchant) view returns (bool)",
  "function allowlistCount(uint256 id) view returns (uint256)",
  "function settledMemos(uint256 id, bytes32 memo) view returns (bool)",
  "function mandates(uint256 id) view returns (address spender, address token, uint128 spendMax, uint128 remaining, uint128 maxPerTx, uint64 validAfter, uint64 validUntil, uint128 rateLimit, uint32 window, uint128 windowSpent, uint64 windowStart, bool paused, bool closed, bytes32 department)",

  "function deposit(address token, uint256 amount)",
  "function withdraw(address token, uint256 amount)",
  "function issue(address spender, address token, uint128 spendMax, uint128 maxPerTx, uint64 validAfter, uint64 validUntil, uint128 rateLimit, uint32 window, bytes32 department) returns (uint256 id)",
  "function topUp(uint256 id, uint128 addedAmount)",
  "function setMerchant(uint256 id, address merchant, bool allowed)",
  "function pause(uint256 id)",
  "function unpause(uint256 id)",
  "function close(uint256 id)",
  "function pay(uint256 id, address merchant, uint128 amount, bytes32 memo)",

  "event Issued(uint256 indexed id, address indexed spender, address indexed token, uint128 spendMax, uint128 maxPerTx, uint64 validAfter, uint64 validUntil, uint128 rateLimit, uint32 window, bytes32 department)",
  "event ToppedUp(uint256 indexed id, uint128 addedAmount, uint128 newRemaining)",
  "event MerchantSet(uint256 indexed id, address indexed merchant, bool allowed)",
  "event Paused(uint256 indexed id, bool paused, address indexed actor)",
  "event Closed(uint256 indexed id, uint128 releasedAmount)",
  "event Paid(uint256 indexed id, address indexed spender, address indexed merchant, address token, uint128 amount, bytes32 memo, uint128 remaining)",
  "event Deposited(address indexed token, uint256 amount, address indexed from)",
  "event Withdrawn(address indexed token, uint256 amount, address indexed to)",

  "error UnknownMandate()",
  "error NotOwner()",
  "error NotTreasuryAdmin()",
  "error NotPolicyOperator()",
  "error NotGuardianOrOperator()",
  "error NotSpender()",
  "error ZeroAddress()",
  "error MandatePaused()",
  "error MandateClosed()",
  "error MandateNotYetValid()",
  "error MandateExpired()",
  "error MerchantNotAllowed()",
  "error CapExceeded()",
  "error PerTxLimitExceeded()",
  "error RateLimited()",
  "error ChallengeAlreadySettled()",
  "error InsufficientTreasury()",
  "error ExceedsUnencumberedBalance()",
  "error ZeroAmount()",
  "error InvalidWindow()",
  "error InvalidSpendMax()",
  "error InvalidValidityRange()",
]);

export const REVERT_ERRORS = [
  "UnknownMandate",
  "NotOwner",
  "NotTreasuryAdmin",
  "NotPolicyOperator",
  "NotGuardianOrOperator",
  "NotSpender",
  "ZeroAddress",
  "MandatePaused",
  "MandateClosed",
  "MandateNotYetValid",
  "MandateExpired",
  "MerchantNotAllowed",
  "CapExceeded",
  "PerTxLimitExceeded",
  "RateLimited",
  "ChallengeAlreadySettled",
  "InsufficientTreasury",
  "ExceedsUnencumberedBalance",
  "ZeroAmount",
  "InvalidWindow",
  "InvalidSpendMax",
  "InvalidValidityRange",
] as const;

export type RevertError = (typeof REVERT_ERRORS)[number];

export interface IssueParams {
  spender: Address;
  token: Address;
  spendMax: bigint;
  maxPerTx: bigint;
  validAfter: bigint;
  validUntil: bigint;
  rateLimit: bigint;
  window: number;
  department: Hex;
}

export interface PayParams {
  id: bigint;
  merchant: Address;
  amount: bigint;
  memo: Hex;
}

export interface SetMerchantParams {
  id: bigint;
  merchant: Address;
  allowed: boolean;
}

export function encodeIssueCalldata(p: IssueParams): Hex {
  return encodeFunctionData({
    abi: MANDATE_BOOK_ABI,
    functionName: "issue",
    args: [
      p.spender,
      p.token,
      p.spendMax,
      p.maxPerTx,
      p.validAfter,
      p.validUntil,
      p.rateLimit,
      p.window,
      p.department,
    ],
  });
}

export function encodePayCalldata(p: PayParams): Hex {
  return encodeFunctionData({
    abi: MANDATE_BOOK_ABI,
    functionName: "pay",
    args: [p.id, p.merchant, p.amount, p.memo],
  });
}

export function encodeSetMerchantCalldata(p: SetMerchantParams): Hex {
  return encodeFunctionData({
    abi: MANDATE_BOOK_ABI,
    functionName: "setMerchant",
    args: [p.id, p.merchant, p.allowed],
  });
}

export function challengeIdToMemo(challengeId: string): Hex {
  return keccak256(stringToHex(challengeId));
}

export function txExplorerUrl(txHash: Hex): string {
  return `${TEMPO_MODERATO.explorerUrl}/tx/${txHash}`;
}

export function addressExplorerUrl(addr: Address): string {
  return `${TEMPO_MODERATO.explorerUrl}/address/${addr}`;
}

/**
 * Strictly parses non-negative USD amounts with up to 6 decimal places.
 * Rejects negative values, >6 decimals, scientific notation, or malformed strings.
 */
export function parseUnits6(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new RangeError(
      `Invalid 6-decimal amount "${value}": expected non-negative number with <= 6 decimals`
    );
  }
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "000000").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(padded);
}

export function formatUnits6(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = (amount % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function extractMandateRevertName(err: unknown): RevertError | null {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  for (const name of REVERT_ERRORS) {
    if (msg.includes(name)) return name;
  }
  return null;
}
