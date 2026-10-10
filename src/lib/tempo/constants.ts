import { addressFrom } from "./hash";

/** Tempo Mainnet — payments L1 incubated by Stripe and Paradigm. */
export const TEMPO = {
  name: "Tempo",
  chainId: 4217,
  finalityMs: 600,
  txType: "0x76",
  decimals: 6,
  factory: "0x20Fc000000000000000000000000000000000000",
  feeManager: "0xfeec000000000000000000000000000000000000",
  dex: "0xdec0000000000000000000000000000000000000",
  tip403: "0x403c000000000000000000000000000000000000",
  pathUsd: "0x20c0000000000000000000000000000000000000",
  usdc: "0x20c0000000000000000000000000000000000001",
  /** attodollars per gas (cap) */
  baseFeePerGas: 12_000_000_000,
  transferGas: 50_000,
  payGas: 84_000,
} as const;

export const MICRO = 1_000_000;

export const COMPANY = {
  name: "Northwind Labs",
  legal: "Northwind Labs Pte. Ltd.",
  department: "research",
  finance: addressFrom("northwind.finance"),
  treasury: addressFrom("northwind.treasury"),
} as const;

export const AGENTS = {
  helios: {
    id: "helios",
    name: "Helios",
    role: "Research agent",
    spender: addressFrom("agent.helios"),
    department: "research",
  },
  courier: {
    id: "courier",
    name: "Courier",
    role: "Payout agent",
    spender: addressFrom("agent.courier"),
    department: "ops",
  },
} as const;

export const MERCHANTS = {
  helios: {
    id: "helios",
    name: "Helios Research",
    origin: "https://api.helios.research",
    path: "/v1/brief",
    address: addressFrom("merchant.helios"),
    priceMicro: 400_000,
    description: "Geopolitical brief, 400ms, USD 0.40 / call",
    body: "Brent 18m forward inverted. Baltic Dry +4.1% WoW. Quiet bid for Singapore-origin naphtha.",
  },
  atlas: {
    id: "atlas",
    name: "Atlas Render",
    origin: "https://atlas.render",
    path: "/v1/generate",
    address: addressFrom("merchant.atlas"),
    priceMicro: 80_000,
    description: "Image generation, USD 0.08 / call",
    body: "job_id=atl_9k2 · 1024×1024 · 12 steps · cached",
  },
  fx: {
    id: "fx",
    name: "Lane FX",
    origin: "https://fx.lane.sh",
    path: "/v1/quote",
    address: addressFrom("merchant.fx"),
    priceMicro: 20_000,
    description: "Firm USD/SGD quote, USD 0.02 / call",
    body: "USD/SGD 1.3412 firm 800ms · notional 250,000",
  },
  shadow: {
    id: "shadow",
    name: "Shadow LLM",
    origin: "https://shadow.llm",
    path: "/v1/complete",
    address: addressFrom("merchant.shadow"),
    priceMicro: 120_000,
    description: "Unlisted model host — used to demonstrate fail-closed allowlists",
    body: null,
  },
} as const;

export type MerchantId = keyof typeof MERCHANTS;
export type AgentId = keyof typeof AGENTS;

export const REVERT = {
  UnknownMandate: "UnknownMandate",
  NotOwner: "NotOwner",
  NotSpender: "NotSpender",
  MandatePaused: "MandatePaused",
  MandateClosed: "MandateClosed",
  MandateNotYetValid: "MandateNotYetValid",
  MandateExpired: "MandateExpired",
  MerchantNotAllowed: "MerchantNotAllowed",
  CapExceeded: "CapExceeded",
  RateLimited: "RateLimited",
  InsufficientTreasury: "InsufficientTreasury",
  ZeroAmount: "ZeroAmount",
  InvalidWindow: "InvalidWindow",
  InvalidSpendMax: "InvalidSpendMax",
} as const;

export type RevertName = (typeof REVERT)[keyof typeof REVERT];
