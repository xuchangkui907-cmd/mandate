import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Lock, Receipt, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { AGENTS, COMPANY, MERCHANTS, TEMPO } from "@/lib/tempo/constants";
import { shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Shell>
      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
              Crypto World's Fair · Tempo pavilion
            </p>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Policy wallets for the agent economy.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Companies issue spend mandates to humans and AI agents. Agents pay APIs over MPP.
              Finance sees a Stripe-like ledger — not fifty hot wallets.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/console" className="no-underline">
                  Open finance console
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/architecture" className="no-underline">
                  Read the architecture
                </Link>
              </Button>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
              <Stat k="Finality" v="0.6s" />
              <Stat k="Gas token" v="pathUSD" />
              <Stat k="Tx type" v={TEMPO.txType} />
            </dl>
          </div>
          <Instrument />
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
            <Point
              icon={<Lock className="size-4" />}
              title="Fail-closed by default"
              body="An empty merchant allowlist cannot pay anyone. The revert is the product — not a bug in the demo."
            />
            <Point
              icon={<Waypoints className="size-4" />}
              title="MPP-native settlement"
              body="HTTP 402 challenge, MandateBook.pay() with memo = challenge id, Payment-Receipt. One request cycle."
            />
            <Point
              icon={<Receipt className="size-4" />}
              title="USD all the way down"
              body="Tempo has no volatile gas token. Fees are attodollars, paid in TIP-20, ~$0.0006 per payment."
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">Why Tempo, not another EVM</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-[-0.03em] sm:text-4xl">
            The chain was built for this exact control plane.
          </h2>
          <div className="mt-8 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-[0.14em] text-subtle">
                <tr>
                  <th className="px-4 py-3 font-medium">Need</th>
                  <th className="px-4 py-3 font-medium">Generic EVM</th>
                  <th className="px-4 py-3 font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody className="text-muted">
                <Row a="Gas" b="Volatile native token" c="Any USD TIP-20 via Fee AMM" />
                <Row a="Micropayments" b="Fee dominates $0.40 API call" c="Payment lane, sub-cent, reserved blockspace" />
                <Row a="Reconciliation" b="Custom event indexing" c="32-byte transfer memo = MPP challenge" />
                <Row a="Agents" b="Home-rolled x402" c="MPP in production with Stripe" />
                <Row a="UX" b="User holds ETH/SOL for gas" c="Finance sponsors type-0x76 feePayer" />
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="font-display text-2xl tracking-tight">Run the 60-second judge walkthrough.</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Issue a fail-closed mandate. Watch Helios hit 402. Allowlist the merchant. Settle.
                Probe an unlist merchant. Every revert is typed.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/console" className="no-underline">
                Launch console
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-subtle">{k}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums text-fg">{v}</dd>
    </div>
  );
}

function Point({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article>
      <div className="flex size-9 items-center justify-center rounded-sm border border-border text-accent">{icon}</div>
      <h3 className="mt-4 font-display text-xl tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}

function Row({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 text-fg">{a}</td>
      <td className="px-4 py-3">{b}</td>
      <td className="px-4 py-3 text-fg">{c}</td>
    </tr>
  );
}

function Instrument() {
  return (
    <aside className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sheet)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">Spend instrument</p>
          <p className="mt-1 font-display text-2xl">Mandate 0001</p>
        </div>
        <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs text-warn">Fail-closed</span>
      </div>
      <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
        <Line k="Issuer" v={COMPANY.legal} />
        <Line k="Spender" v={`${AGENTS.helios.name} · ${shortAddr(AGENTS.helios.spender)}`} />
        <Line k="Cap" v="50.00 pathUSD" />
        <Line k="Rate" v="10.00 / hour" />
        <Line k="Allowlist" v="empty — no merchant can settle" />
        <Line k="Token" v={`pathUSD · ${shortAddr(TEMPO.pathUsd)}`} />
        <Line k="Chain" v={`Tempo · ${TEMPO.chainId}`} />
      </dl>
      <p className="mt-6 border-t border-border pt-4 font-mono text-[11px] leading-relaxed text-subtle">
        GET {MERCHANTS.helios.origin}
        {MERCHANTS.helios.path}
        <br />
        ← 402 · WWW-Authenticate: Payment
        <br />
        → pay() revert MerchantNotAllowed()
      </p>
    </aside>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-subtle">{k}</dt>
      <dd className="text-right font-mono text-xs text-fg">{v}</dd>
    </div>
  );
}
