import { REVERT, TEMPO, type RevertName } from "./constants";
import { feeMicro } from "./fees";
import { txHashDeterministic } from "./hash";
import type { Address, Bytes32, Mandate, MandateStatus } from "./types";

export interface BookState {
  owner: Address;
  nextId: number;
  mandates: Record<number, Mandate>;
  balances: Record<Address, number>;
  blockNumber: number;
}

export interface PayOk {
  ok: true;
  mandate: Mandate;
  remaining: number;
  windowSpent: number;
  txHash: `0x${string}`;
  feeMicro: number;
  lane: "payment";
  blockNumber: number;
}

export interface PayErr {
  ok: false;
  revert: RevertName;
}

function inWindow(m: Mandate, now: number): { windowStart: number; windowSpent: number } {
  if (m.window === 0) return { windowStart: m.windowStart, windowSpent: m.windowSpent };
  if (now >= m.windowStart + m.window) return { windowStart: now, windowSpent: 0 };
  return { windowStart: m.windowStart, windowSpent: m.windowSpent };
}

export function statusOf(m: Mandate, now: number): MandateStatus {
  if (m.closed) return "closed";
  if (now > m.validUntil) return "expired";
  if (m.paused) return "paused";
  return "active";
}

export function issueMandate(
  state: BookState,
  params: Omit<Mandate, "id" | "remaining" | "windowSpent" | "windowStart" | "paused" | "closed" | "issuedAt"> & {
    issuedAt?: number;
  },
): { state: BookState; mandate: Mandate } | { error: RevertName } {
  if (params.spendMax <= 0) return { error: REVERT.InvalidSpendMax };
  if (params.window === 0 && params.rateLimit > 0) return { error: REVERT.InvalidWindow };
  const id = state.nextId;
  const now = params.issuedAt ?? Date.now();
  const mandate: Mandate = {
    ...params,
    id,
    remaining: params.spendMax,
    windowSpent: 0,
    windowStart: now,
    paused: false,
    closed: false,
    issuedAt: now,
  };
  return {
    mandate,
    state: {
      ...state,
      nextId: id + 1,
      mandates: { ...state.mandates, [id]: mandate },
    },
  };
}

export function setMerchant(
  state: BookState,
  id: number,
  merchant: Address,
  allowed: boolean,
): BookState | { error: RevertName } {
  const m = state.mandates[id];
  if (!m) return { error: REVERT.UnknownMandate };
  const has = m.allowlist.includes(merchant);
  let allowlist = m.allowlist;
  if (allowed && !has) allowlist = [...m.allowlist, merchant];
  if (!allowed && has) allowlist = m.allowlist.filter((a) => a !== merchant);
  return {
    ...state,
    mandates: { ...state.mandates, [id]: { ...m, allowlist } },
  };
}

export function pauseMandate(state: BookState, id: number, paused: boolean): BookState | { error: RevertName } {
  const m = state.mandates[id];
  if (!m) return { error: REVERT.UnknownMandate };
  if (m.closed) return { error: REVERT.MandateClosed };
  return { ...state, mandates: { ...state.mandates, [id]: { ...m, paused } } };
}

export function closeMandate(state: BookState, id: number): BookState | { error: RevertName } {
  const m = state.mandates[id];
  if (!m) return { error: REVERT.UnknownMandate };
  return { ...state, mandates: { ...state.mandates, [id]: { ...m, closed: true, paused: true } } };
}

export function pay(args: {
  state: BookState;
  id: number;
  spender: Address;
  merchant: Address;
  amount: number;
  memo: Bytes32;
  now?: number;
}): PayOk | PayErr {
  const { state, id, spender, merchant, amount } = args;
  const now = args.now ?? Date.now();
  const m = state.mandates[id];
  if (!m) return { ok: false, revert: REVERT.UnknownMandate };
  if (m.closed) return { ok: false, revert: REVERT.MandateClosed };
  if (m.paused) return { ok: false, revert: REVERT.MandatePaused };
  if (now < m.validAfter) return { ok: false, revert: REVERT.MandateNotYetValid };
  if (now > m.validUntil) return { ok: false, revert: REVERT.MandateExpired };
  if (spender.toLowerCase() !== m.spender.toLowerCase()) return { ok: false, revert: REVERT.NotSpender };
  if (amount <= 0) return { ok: false, revert: REVERT.ZeroAmount };
  if (!m.allowlist.some((a) => a.toLowerCase() === merchant.toLowerCase())) {
    return { ok: false, revert: REVERT.MerchantNotAllowed };
  }
  if (m.remaining < amount) return { ok: false, revert: REVERT.CapExceeded };

  const win = inWindow(m, now);
  if (m.rateLimit > 0 && win.windowSpent + amount > m.rateLimit) {
    return { ok: false, revert: REVERT.RateLimited };
  }

  const tokenBal = state.balances[m.token] ?? 0;
  const gas = feeMicro(TEMPO.payGas);
  if (tokenBal < amount + gas) return { ok: false, revert: REVERT.InsufficientTreasury };

  const next: Mandate = {
    ...m,
    remaining: m.remaining - amount,
    windowStart: win.windowStart,
    windowSpent: win.windowSpent + amount,
  };
  const blockNumber = state.blockNumber + 1;
  const txHash = txHashDeterministic(`pay:${id}:${merchant}:${amount}:${args.memo}:${blockNumber}`);

  return {
    ok: true,
    mandate: next,
    remaining: next.remaining,
    windowSpent: next.windowSpent,
    txHash,
    feeMicro: gas,
    lane: "payment",
    blockNumber,
  };
}
