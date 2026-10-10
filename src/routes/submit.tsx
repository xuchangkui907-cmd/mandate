import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/submit")({ component: SubmitPage });

function SubmitPage() {
  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs uppercase tracking-[0.22em] text-subtle">Colosseum · due 12 Oct 2026</p>
        <h1 className="mt-3 font-display text-4xl tracking-[-0.03em]">Submission kit</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Colosseum judges startups, not demos. Use this page as the copy deck for the Arena form,
          the 3-minute pitch, and the technical walkthrough.
        </p>

        <H>One-liner</H>
        <Quote>
          Mandate issues policy-bound spend authorizations so AI agents can pay APIs on Tempo without
          holding the company treasury.
        </Quote>

        <H>Pitch video (2:45)</H>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-muted">
          <li>0:00 Team — who has paid an API bill or run contractor payouts.</li>
          <li>0:20 Problem — agents will spend; finance will not pre-fund fifty wallets.</li>
          <li>0:40 Product — mandates, fail-closed allowlists, MPP receipts.</li>
          <li>1:10 Uncut console demo: 402 → MerchantNotAllowed → allowlist → 200 → Shadow LLM revert.</li>
          <li>2:10 Business — 0.8% of volume + $99/seat. Customer: any company deploying agents.</li>
          <li>2:35 Why Tempo — stablecoin gas, payment lanes, MPP with Stripe, 0.6s finality.</li>
        </ol>

        <H>Judging map</H>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-muted">
          <li>
            <strong className="font-medium text-fg">Functionality.</strong> Public URL. Walkthrough
            button. Typed reverts. CSV ledger.
          </li>
          <li>
            <strong className="font-medium text-fg">Impact.</strong> Corporate API + contractor spend
            is a real budget line. Agents make it continuous.
          </li>
          <li>
            <strong className="font-medium text-fg">Novelty.</strong> Not an x402 wrapper — the
            missing control plane. Flovia (Frontier) was analytics; this is authorization + settlement.
          </li>
          <li>
            <strong className="font-medium text-fg">UX.</strong> Finance never sees a seed phrase. Gas
            is USD. Failure is visible.
          </li>
          <li>
            <strong className="font-medium text-fg">Open-source.</strong> MandateBook.sol, Foundry
            tests, 10-line SDK, isomorphic VM.
          </li>
          <li>
            <strong className="font-medium text-fg">Business.</strong> SaaS + take rate. No token
            required to charge.
          </li>
        </ul>

        <H>Repo layout</H>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-[12px] leading-relaxed">
{`contracts/     MandateBook.sol + Foundry tests
sdk/           ABI fragments, Tempo constants
src/lib/tempo  Isomorphic VM (same errors as Solidity)
src/routes     Console, architecture, this kit`}
        </pre>

        <H>90-day plan (say this in the last 20 seconds)</H>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-muted">
          <li>Deploy MandateBook to Tempo, pathUSD deposits, one design-partner agent.</li>
          <li>MPP session vouchers so a cap is reserved once and many 402s stream off-chain.</li>
          <li>SOC2-shaped export: department codes, CSV, webhook to NetSuite/Brex.</li>
        </ol>

        <H>Do not</H>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted">
          <li>Exceed three minutes.</li>
          <li>Lead with tokenomics.</li>
          <li>Skip the revert. Judges need to see fail-closed.</li>
          <li>Submit without a public URL and a README that issues a mandate in one command.</li>
        </ul>
      </main>
    </Shell>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-12 font-display text-2xl tracking-tight">{children}</h2>;
}

function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="mt-4 border-l-2 border-accent pl-4 font-display text-xl leading-snug tracking-tight text-fg">
      {children}
    </blockquote>
  );
}
