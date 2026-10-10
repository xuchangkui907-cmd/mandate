import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { TEMPO } from "@/lib/tempo/constants";
import { shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/architecture")({ component: ArchitecturePage });

function ArchitecturePage() {
  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs uppercase tracking-[0.22em] text-subtle">Technical design · Tempo chainId {TEMPO.chainId}</p>
        <h1 className="mt-3 font-display text-4xl tracking-[-0.03em]">Architecture</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Mandate is a policy engine that sits in front of Tempo TIP-20 transfers. Agents never hold
          treasury keys. Every paid HTTP request is an MPP challenge whose on-chain memo is the
          challenge id. This page is the design the Solidity in <span className="font-mono text-fg">contracts/</span> implements 1:1
          with the in-browser VM.
        </p>

        <H>Control plane</H>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Finance (owner) deposits pathUSD into MandateBook. Issuing a mandate creates a spend
          policy: spender, cap, validity window, hourly rate, department code, merchant allowlist.
          Empty allowlist is fail-closed. The spender key — typically an agent session key — may
          only call <Code>pay(id, merchant, amount, memo)</Code>.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-[12px] leading-relaxed text-fg">
{`CompanyTreasury  (TIP-20 pathUSD)
        │
        ▼
   MandateBook
     ├── Mandate #n
     │     spender, spendMax, remaining
     │     validAfter / validUntil
     │     rateLimit / window
     │     allowlist[]   // empty = deny all
     │     paused / closed
     └── pay()
           checks policy
           transferWithMemo(merchant, amount, challengeId)
           feePayer = finance  (Tempo type 0x76)`}
        </pre>

        <H>Why these Tempo primitives</H>
        <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted">
          <li>
            <strong className="font-medium text-fg">TIP-20, 6 decimals.</strong> pathUSD at{" "}
            <span className="font-mono text-xs text-fg">{shortAddr(TEMPO.pathUsd, 6)}</span>. Memos are
            32 bytes — we store the MPP challenge id so finance reconciliation is a join, not a guess.
          </li>
          <li>
            <strong className="font-medium text-fg">Stablecoin gas.</strong> Fees in attodollars, paid in
            the same TIP-20. A pay() is ~84k gas ≈ $0.001 at the cap. Finance sponsors via{" "}
            <Code>feePayer</Code> so the agent hot wallet can be empty.
          </li>
          <li>
            <strong className="font-medium text-fg">Payment lanes.</strong> TIP-20 transfers ride reserved
            blockspace. Agent micropayments do not compete with general compute during congestion.
          </li>
          <li>
            <strong className="font-medium text-fg">0.6s finality.</strong> MPP is a synchronous HTTP
            cycle. The merchant can wait for inclusion before returning 200.
          </li>
          <li>
            <strong className="font-medium text-fg">Type 0x76.</strong> Native batching, concurrent nonces,
            passkeys, scheduled txs — no 4337 bundler.
          </li>
        </ul>

        <H>MPP flow</H>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-muted">
          <li>Agent GET resource, no credential.</li>
          <li>
            Merchant 402 + <Code>WWW-Authenticate: Payment method="tempo" ...</Code>
          </li>
          <li>
            Agent calls MandateBook.pay with <Code>memo = bytes32(challengeId)</Code>.
          </li>
          <li>On success, retry with <Code>Authorization: Payment</Code> carrying the tx hash.</li>
          <li>Merchant verifies transfer + memo, returns 200 and Payment-Receipt.</li>
          <li>On policy miss, pay() reverts a typed error. Merchant never sees funds.</li>
        </ol>

        <H>Custom errors</H>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Typed reverts are part of the UX. The console renders them next to the HTTP trace so finance
          can see why an agent was stopped — MerchantNotAllowed, CapExceeded, RateLimited, MandatePaused,
          MandateExpired, NotSpender, InsufficientTreasury, ZeroAmount.
        </p>

        <H>Security notes</H>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted">
          <li>Fail-closed allowlist. Unknown merchants cannot drain a cap.</li>
          <li>Spender is not owner. Compromised agent key cannot withdraw treasury.</li>
          <li>Rate window resets only after <Code>window</Code> seconds, not on every pay.</li>
          <li>pause() is a one-transaction freeze. close() is terminal.</li>
          <li>Reentrancy guard around pay() before the TIP-20 transfer.</li>
          <li>
            This demo runs an isomorphic VM in the browser so judges can click the failure path without
            a wallet. Production deploy: Foundry script against Tempo mainnet/testnet, pathUSD as token.
          </li>
        </ul>

        <H>Protocol addresses</H>
        <dl className="mt-4 space-y-2 font-mono text-xs">
          <Addr k="TIP-20 Factory" v={TEMPO.factory} />
          <Addr k="pathUSD" v={TEMPO.pathUsd} />
          <Addr k="USDC" v={TEMPO.usdc} />
          <Addr k="Fee Manager" v={TEMPO.feeManager} />
          <Addr k="Stablecoin DEX" v={TEMPO.dex} />
          <Addr k="TIP-403 registry" v={TEMPO.tip403} />
        </dl>
      </main>
    </Shell>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-12 font-display text-2xl tracking-tight">{children}</h2>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-sm bg-elevated px-1.5 py-0.5 font-mono text-[13px] text-fg">{children}</code>;
}

function Addr({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border py-2 sm:flex-row sm:items-baseline sm:justify-between">
      <dt className="font-sans text-xs uppercase tracking-[0.14em] text-subtle">{k}</dt>
      <dd className="break-all text-muted">{v}</dd>
    </div>
  );
}
