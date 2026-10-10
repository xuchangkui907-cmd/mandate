import { create } from "zustand";
import { AGENTS, COMPANY, MERCHANTS, MICRO, REVERT, TEMPO, type MerchantId } from "@/lib/tempo/constants";
import {
  closeMandate,
  issueMandate,
  pauseMandate,
  pay,
  setMerchant,
  statusOf,
  type BookState,
} from "@/lib/tempo/mandate";
import { challengeHeader, credentialHeader, issueChallenge, memoFromChallenge, receiptHeader } from "@/lib/tempo/mpp";
import type { Block, Mandate, Receipt, TraceLine } from "@/lib/tempo/types";
import { formatUsd } from "@/lib/utils";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function seedBook(): BookState {
  const now = Date.now();
  const empty: BookState = {
    owner: COMPANY.finance,
    nextId: 1,
    mandates: {},
    balances: { [TEMPO.pathUsd]: 2_500 * MICRO },
    blockNumber: 184220,
  };
  const issued = issueMandate(empty, {
    spender: AGENTS.helios.spender,
    spenderLabel: AGENTS.helios.name,
    token: TEMPO.pathUsd,
    spendMax: 50 * MICRO,
    validAfter: now - 60_000,
    validUntil: now + THIRTY_DAYS,
    rateLimit: 10 * MICRO,
    window: 3600_000,
    department: "research",
    allowlist: [],
  });
  if ("error" in issued) return empty;
  return issued.state;
}

export interface Walkthrough {
  running: boolean;
  step: number;
  total: number;
  caption: string;
}

interface AppState {
  book: BookState;
  receipts: Receipt[];
  blocks: Block[];
  traces: TraceLine[];
  selectedMandateId: number | null;
  walkthrough: Walkthrough;
  reset: () => void;
  deposit: (micro: number) => void;
  issue: (input: {
    spenderLabel: string;
    spender: Mandate["spender"];
    spendMax: number;
    rateLimit: number;
    windowHours: number;
    days: number;
    department: string;
    merchants: Mandate["allowlist"];
  }) => number | null;
  allowMerchant: (id: number, merchant: Mandate["allowlist"][number], allowed: boolean) => void;
  pause: (id: number, paused: boolean) => void;
  close: (id: number) => void;
  request: (mandateId: number, merchantId: MerchantId, spender?: Mandate["spender"]) => Receipt | null;
  runWalkthrough: () => Promise<void>;
  selectMandate: (id: number | null) => void;
}

let walkthroughLock = false;

function pushTrace(traces: TraceLine[], line: Omit<TraceLine, "id" | "timestamp">): TraceLine[] {
  const next: TraceLine = {
    ...line,
    id: `${Date.now()}-${traces.length}-${Math.random().toString(16).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  return [...traces, next].slice(-80);
}

function genesis(): Pick<AppState, "book" | "receipts" | "blocks" | "traces" | "selectedMandateId" | "walkthrough"> {
  const book = seedBook();
  const first = book.mandates[1];
  return {
    book,
    receipts: [],
    blocks: [
      {
        number: book.blockNumber,
        timestamp: Date.now(),
        txHash: "0x00genesis000000000000000000000000000000000000000000000000000001",
        lane: "general",
        from: COMPANY.finance,
        to: COMPANY.treasury,
        summary: `Treasury seeded · ${formatUsd(book.balances[TEMPO.pathUsd] ?? 0)} pathUSD`,
        feeMicro: 0,
        status: "success",
      },
    ],
    traces: [],
    selectedMandateId: first ? first.id : null,
    walkthrough: { running: false, step: 0, total: 4, caption: "Issue a fail-closed mandate, then watch the agent hit a 402." },
  };
}

export const useMandate = create<AppState>()((set, get) => ({
  ...genesis(),

  reset: () => set(genesis()),

  deposit: (micro) => {
    const { book } = get();
    set({
      book: {
        ...book,
        blockNumber: book.blockNumber + 1,
        balances: {
          ...book.balances,
          [TEMPO.pathUsd]: (book.balances[TEMPO.pathUsd] ?? 0) + micro,
        },
      },
    });
  },

  issue: (input) => {
    const { book } = get();
    const now = Date.now();
    const result = issueMandate(book, {
      spender: input.spender,
      spenderLabel: input.spenderLabel,
      token: TEMPO.pathUsd,
      spendMax: input.spendMax,
      validAfter: now,
      validUntil: now + input.days * 24 * 60 * 60 * 1000,
      rateLimit: input.rateLimit,
      window: input.windowHours * 3600_000,
      department: input.department,
      allowlist: input.merchants,
    });
    if ("error" in result) return null;
    set({
      book: result.state,
      selectedMandateId: result.mandate.id,
      traces: pushTrace(get().traces, {
        kind: "chain",
        title: `Mandate #${result.mandate.id} issued`,
        detail: `${input.spenderLabel} · cap ${formatUsd(input.spendMax)} pathUSD · allowlist ${input.merchants.length}`,
      }),
    });
    return result.mandate.id;
  },

  allowMerchant: (id, merchant, allowed) => {
    const next = setMerchant(get().book, id, merchant, allowed);
    if ("error" in next) return;
    const name = Object.values(MERCHANTS).find((m) => m.address === merchant)?.name ?? merchant;
    set({
      book: next,
      traces: pushTrace(get().traces, {
        kind: "chain",
        title: allowed ? `Allowlisted ${name}` : `Removed ${name}`,
        detail: `Mandate #${id}`,
      }),
    });
  },

  pause: (id, paused) => {
    const next = pauseMandate(get().book, id, paused);
    if ("error" in next) return;
    set({ book: next });
  },

  close: (id) => {
    const next = closeMandate(get().book, id);
    if ("error" in next) return;
    set({ book: next });
  },

  selectMandate: (id) => set({ selectedMandateId: id }),

  request: (mandateId, merchantId, spender) => {
    const merchant = MERCHANTS[merchantId];
    const resource = `${merchant.origin}${merchant.path}`;
    const challenge = issueChallenge({
      amount: merchant.priceMicro,
      recipient: merchant.address,
      resource,
    });
    let traces = get().traces;
    traces = pushTrace(traces, {
      kind: "http",
      title: `GET ${resource}`,
      detail: "Authorization: (none)",
    });
    traces = pushTrace(traces, {
      kind: "http",
      title: "402 Payment Required",
      detail: challengeHeader(challenge),
    });

    const memo = memoFromChallenge(challenge.id);
    const book = get().book;
    const mandate = book.mandates[mandateId];
    const from = spender ?? mandate?.spender ?? AGENTS.helios.spender;
    const result = pay({
      state: book,
      id: mandateId,
      spender: from,
      merchant: merchant.address,
      amount: merchant.priceMicro,
      memo,
    });

    if (!result.ok) {
      traces = pushTrace(traces, {
        kind: "error",
        title: `revert ${result.revert}()`,
        detail: explainRevert(result.revert, merchant.name),
      });
      const revertReceipt: Receipt = {
        id: challenge.id,
        mandateId,
        merchant: merchant.address,
        merchantName: merchant.name,
        origin: merchant.origin,
        amount: merchant.priceMicro,
        memo,
        challengeId: challenge.id,
        txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        blockNumber: book.blockNumber,
        feeMicro: 0,
        lane: "payment",
        department: mandate?.department ?? "research",
        timestamp: Date.now(),
        status: "reverted",
        revert: result.revert,
      };
      set({
        traces,
        receipts: [revertReceipt, ...get().receipts].slice(0, 80),
        blocks: [
          {
            number: book.blockNumber + 1,
            timestamp: Date.now(),
            txHash: revertReceipt.txHash,
            lane: "payment" as const,
            from,
            to: merchant.address,
            summary: `pay() reverted ${result.revert}`,
            feeMicro: 0,
            status: "revert" as const,
            revert: result.revert,
          },
          ...get().blocks,
        ].slice(0, 80),
        book: { ...book, blockNumber: book.blockNumber + 1 },
      });
      return revertReceipt;
    }

    traces = pushTrace(traces, {
      kind: "chain",
      title: `MandateBook.pay(#${mandateId}, ${merchant.name}, ${formatUsd(merchant.priceMicro)})`,
      detail: `memo=${memo.slice(0, 18)}… · type ${TEMPO.txType} · lane payment`,
    });
    traces = pushTrace(traces, {
      kind: "http",
      title: "GET (retry) Authorization: Payment",
      detail: credentialHeader(mandateId, result.txHash, challenge.id),
    });
    traces = pushTrace(traces, {
      kind: "ok",
      title: "200 OK · Payment-Receipt",
      detail: receiptHeader({
        challengeId: challenge.id,
        txHash: result.txHash,
        amount: merchant.priceMicro,
        blockNumber: result.blockNumber,
      }),
    });

    const receipt: Receipt = {
      id: challenge.id,
      mandateId,
      merchant: merchant.address,
      merchantName: merchant.name,
      origin: merchant.origin,
      amount: merchant.priceMicro,
      memo,
      challengeId: challenge.id,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      feeMicro: result.feeMicro,
      lane: "payment",
      department: result.mandate.department,
      timestamp: Date.now(),
      status: "settled",
      body: merchant.body,
    };

    const token = TEMPO.pathUsd;
    set({
      traces,
      receipts: [receipt, ...get().receipts].slice(0, 80),
      book: {
        ...book,
        blockNumber: result.blockNumber,
        mandates: { ...book.mandates, [mandateId]: result.mandate },
        balances: {
          ...book.balances,
          [token]: (book.balances[token] ?? 0) - merchant.priceMicro - result.feeMicro,
        },
      },
      blocks: [
        {
          number: result.blockNumber,
          timestamp: Date.now(),
          txHash: result.txHash,
          lane: "payment" as const,
          from,
          to: merchant.address,
          summary: `Settled ${formatUsd(merchant.priceMicro)} pathUSD → ${merchant.name}`,
          feeMicro: result.feeMicro,
          status: "success" as const,
        },
        ...get().blocks,
      ].slice(0, 80),
    });
    return receipt;
  },

  runWalkthrough: async () => {
    if (walkthroughLock) return;
    walkthroughLock = true;
    get().reset();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const beat = reduced ? 80 : 900;

    try {
      set({
        walkthrough: {
          running: true,
          step: 1,
          total: 4,
          caption: "Finance issues Mandate #1 — $50 cap, empty allowlist, fail-closed.",
        },
        traces: [],
      });
      await sleep(beat);

      set({
        walkthrough: {
          running: true,
          step: 2,
          total: 4,
          caption: "Helios requests Helios Research. Empty allowlist → MerchantNotAllowed.",
        },
      });
      await sleep(beat / 2);
      get().request(1, "helios");
      await sleep(beat);

      set({
        walkthrough: {
          running: true,
          step: 3,
          total: 4,
          caption: "Finance allowlists api.helios.research. Agent retries. 200 + receipt.",
        },
      });
      get().allowMerchant(1, MERCHANTS.helios.address, true);
      await sleep(beat);
      get().request(1, "helios");
      await sleep(beat);

      set({
        walkthrough: {
          running: true,
          step: 4,
          total: 4,
          caption: "Agent hits Shadow LLM (not listed) — policy holds. That failure is the product.",
        },
      });
      await sleep(beat / 2);
      get().request(1, "shadow");
      await sleep(beat);

      set({
        walkthrough: {
          running: false,
          step: 4,
          total: 4,
          caption: "Walkthrough complete. Issue another mandate or keep probing merchants.",
        },
      });
    } finally {
      walkthroughLock = false;
    }
  },
}));

export function explainRevert(name: string, merchant?: string): string {
  switch (name) {
    case REVERT.MerchantNotAllowed:
      return `${merchant ?? "Merchant"} is not on this mandate's allowlist. Fail-closed by design.`;
    case REVERT.CapExceeded:
      return "Remaining cap is below the challenge amount.";
    case REVERT.RateLimited:
      return "Hourly window spent would exceed rateLimit.";
    case REVERT.MandatePaused:
      return "Finance paused this mandate.";
    case REVERT.MandateClosed:
      return "Mandate is closed.";
    case REVERT.MandateExpired:
      return "validUntil has passed.";
    case REVERT.NotSpender:
      return "msg.sender is not the mandate spender.";
    case REVERT.InsufficientTreasury:
      return "Treasury cannot cover amount + stablecoin gas.";
    case REVERT.ZeroAmount:
      return "amount must be > 0.";
    default:
      return name;
  }
}

export function mandateList(book: BookState): Mandate[] {
  return Object.values(book.mandates).sort((a, b) => b.id - a.id);
}

export { statusOf };
