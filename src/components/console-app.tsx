import { useMemo, useState, type ReactNode } from "react";
import { Play, RotateCcw, Pause, Ban, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENTS, MERCHANTS, MICRO, TEMPO, type MerchantId } from "@/lib/tempo/constants";
import { mandateList, statusOf, useMandate } from "@/lib/store";
import type { Mandate, Receipt } from "@/lib/tempo/types";
import { cn, formatUsd, shortAddr, shortHash } from "@/lib/utils";

export function ConsoleApp() {
  const book = useMandate((s) => s.book);
  const receipts = useMandate((s) => s.receipts);
  const traces = useMandate((s) => s.traces);
  const walkthrough = useMandate((s) => s.walkthrough);
  const selectedMandateId = useMandate((s) => s.selectedMandateId);
  const runWalkthrough = useMandate((s) => s.runWalkthrough);
  const reset = useMandate((s) => s.reset);
  const request = useMandate((s) => s.request);
  const selectMandate = useMandate((s) => s.selectMandate);
  const allowMerchant = useMandate((s) => s.allowMerchant);
  const pause = useMandate((s) => s.pause);
  const close = useMandate((s) => s.close);
  const issue = useMandate((s) => s.issue);

  const mandates = mandateList(book);
  const selected = mandates.find((m) => m.id === selectedMandateId) ?? mandates[0];
  const treasury = book.balances[TEMPO.pathUsd] ?? 0;
  const settled = receipts.filter((r) => r.status === "settled");
  const volume = settled.reduce((a, r) => a + r.amount, 0);
  const fees = settled.reduce((a, r) => a + r.feeMicro, 0);

  const [merchantId, setMerchantId] = useState<MerchantId>("helios");

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">Northwind Labs · finance</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Treasury console</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void runWalkthrough()} disabled={walkthrough.running}>
            <Play />
            Run judge walkthrough
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw />
            Reset
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-1.5 rounded-full bg-success",
              walkthrough.running && "animate-[pulse-live_1.2s_ease-in-out_infinite]",
            )}
          />
          <p className="text-sm text-muted">
            <span className="font-mono text-xs text-subtle">
              {walkthrough.step}/{walkthrough.total}
            </span>{" "}
            {walkthrough.caption}
          </p>
        </div>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Treasury" value={`$${formatUsd(treasury)}`} hint="pathUSD · TIP-20" />
        <Kpi label="Settled" value={`$${formatUsd(volume)}`} hint={`${settled.length} receipts`} />
        <Kpi label="Gas paid" value={`$${formatUsd(fees)}`} hint="stablecoin fee AMM" />
        <Kpi label="Head block" value={String(book.blockNumber)} hint={`chain ${TEMPO.chainId}`} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <Panel title="Mandates">
            {mandates.length === 0 ? (
              <p className="text-sm text-muted">No mandates issued.</p>
            ) : (
              <ul className="divide-y divide-border">
                {mandates.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => selectMandate(m.id)}
                      className={cn(
                        "flex w-full min-h-11 items-start justify-between gap-3 py-3 text-left",
                        selected?.id === m.id ? "text-fg" : "text-muted",
                      )}
                    >
                      <div>
                        <p className="font-mono text-xs text-subtle">#{String(m.id).padStart(4, "0")}</p>
                        <p className="mt-0.5 text-sm text-fg">{m.spenderLabel}</p>
                        <p className="mt-1 font-mono text-xs">
                          {formatUsd(m.remaining)} / {formatUsd(m.spendMax)}
                        </p>
                      </div>
                      <StatusChip mandate={m} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {selected ? (
            <MandateDetail
              mandate={selected}
              onAllow={(addr, allowed) => allowMerchant(selected.id, addr, allowed)}
              onPause={() => pause(selected.id, !selected.paused)}
              onClose={() => close(selected.id)}
            />
          ) : null}

          <IssueForm
            onIssue={(cap) => {
              issue({
                spenderLabel: AGENTS.helios.name,
                spender: AGENTS.helios.spender,
                spendMax: cap * MICRO,
                rateLimit: Math.max(1, Math.round(cap / 5)) * MICRO,
                windowHours: 1,
                days: 30,
                department: "research",
                merchants: [],
              });
            }}
          />
        </div>

        <div className="space-y-6">
          <Panel title="Agent lab">
            <p className="text-sm text-muted">
              Helios holds the spender key for mandate #{selected?.id ?? "—"}. It cannot move treasury funds
              except through <span className="font-mono text-fg">pay()</span>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(Object.keys(MERCHANTS) as MerchantId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMerchantId(id)}
                  className={cn(
                    "h-11 rounded-sm border px-3 text-sm",
                    merchantId === id
                      ? "border-accent bg-elevated text-fg"
                      : "border-border text-muted hover:text-fg",
                  )}
                >
                  {MERCHANTS[id].name}
                  <span className="ml-2 font-mono text-xs text-subtle">
                    ${formatUsd(MERCHANTS[id].priceMicro)}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 font-mono text-xs leading-relaxed text-subtle">
              {MERCHANTS[merchantId].origin}
              {MERCHANTS[merchantId].path}
              <br />
              {MERCHANTS[merchantId].description}
            </p>
            <Button
              className="mt-4"
              disabled={!selected}
              onClick={() => selected && request(selected.id, merchantId)}
            >
              Request paid resource
            </Button>
          </Panel>

          <Panel title="Wire">
            {traces.length === 0 ? (
              <p className="text-sm text-muted">No calls yet. Run the walkthrough or request a resource.</p>
            ) : (
              <ol className="space-y-2 font-mono text-[12px] leading-relaxed">
                {traces.slice(-12).map((t) => (
                  <li
                    key={t.id}
                    className={cn(
                      "rounded-sm border border-border bg-inset px-3 py-2",
                      t.kind === "error" && "border-danger/40 text-danger",
                      t.kind === "ok" && "border-success/40 text-success",
                      t.kind === "http" && "text-lane",
                      t.kind === "chain" && "text-fg",
                    )}
                  >
                    <div>{t.title}</div>
                    {t.detail ? <div className="mt-1 break-all text-subtle">{t.detail}</div> : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </section>

      <Ledger receipts={receipts} />
    </main>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-subtle">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <h2 className="font-display text-xl tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatusChip({ mandate }: { mandate: Mandate }) {
  const status = statusOf(mandate, Date.now());
  const tone = status === "active" ? "live" : status === "paused" ? "warn" : "danger";
  return <Badge tone={tone}>{status}</Badge>;
}

function MandateDetail({
  mandate,
  onAllow,
  onPause,
  onClose,
}: {
  mandate: Mandate;
  onAllow: (addr: `0x${string}`, allowed: boolean) => void;
  onPause: () => void;
  onClose: () => void;
}) {
  const pct = mandate.spendMax === 0 ? 0 : Math.round((1 - mandate.remaining / mandate.spendMax) * 100);
  return (
    <Panel title={`Mandate #${String(mandate.id).padStart(4, "0")}`}>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-subtle">Spender</dt>
          <dd className="mt-1 font-mono text-xs">
            {mandate.spenderLabel}
            <br />
            {shortAddr(mandate.spender, 5)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-subtle">Department</dt>
          <dd className="mt-1">{mandate.department}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-subtle">
          <span>Drawn</span>
          <span className="font-mono tabular-nums">{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-inset">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.14em] text-subtle">Allowlist</p>
        <ul className="mt-2 space-y-2">
          {(Object.keys(MERCHANTS) as MerchantId[]).map((id) => {
            const merch = MERCHANTS[id];
            const on = mandate.allowlist.includes(merch.address);
            return (
              <li key={id} className="flex items-center justify-between gap-3">
                <span className="text-sm">
                  {merch.name}
                  <span className="ml-2 font-mono text-xs text-subtle">{shortAddr(merch.address)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onAllow(merch.address, !on)}
                  className={cn(
                    "h-11 min-w-20 rounded-sm border px-3 text-sm",
                    on ? "border-success/40 text-success" : "border-border text-muted",
                  )}
                >
                  {on ? "Listed" : "Block"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onPause}>
          <Pause />
          {mandate.paused ? "Unpause" : "Pause"}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          <Ban />
          Close
        </Button>
      </div>
    </Panel>
  );
}

function IssueForm({ onIssue }: { onIssue: (cap: number) => void }) {
  const [cap, setCap] = useState("50");
  return (
    <Panel title="Issue mandate">
      <div className="grid gap-3">
        <Label htmlFor="cap">Cap (pathUSD)</Label>
        <Input
          id="cap"
          inputMode="decimal"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
        />
        <p className="text-xs text-subtle">
          Spender Helios · 1h rate window · empty allowlist · 30 day validity. Fail-closed until you list a
          merchant.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            const n = Number(cap);
            if (!Number.isFinite(n) || n <= 0) return;
            onIssue(n);
          }}
        >
          Issue to Helios
        </Button>
      </div>
    </Panel>
  );
}

function Ledger({ receipts }: { receipts: Receipt[] }) {
  const csv = useMemo(() => {
    const head = ["time", "status", "mandate", "merchant", "amount", "fee", "tx", "challenge"];
    const rows = receipts.map((r) =>
      [
        new Date(r.timestamp).toISOString(),
        r.status,
        r.mandateId,
        r.merchantName,
        formatUsd(r.amount),
        formatUsd(r.feeMicro),
        r.txHash,
        r.challengeId,
      ].join(","),
    );
    return [head.join(","), ...rows].join("\n");
  }, [receipts]);

  function download() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mandate-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl tracking-tight">Ledger</h2>
        <Button variant="ghost" size="sm" onClick={download} disabled={receipts.length === 0}>
          <Download />
          CSV
        </Button>
      </div>
      {receipts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No receipts. Settled MPP payments appear here with challenge ids.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Merchant</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Fee</th>
                <th className="pb-2 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id + String(r.timestamp)} className="border-t border-border">
                  <td className="py-3">
                    {r.status === "settled" ? (
                      <Badge tone="live">settled</Badge>
                    ) : (
                      <Badge tone="danger">{r.revert}</Badge>
                    )}
                  </td>
                  <td className="py-3">{r.merchantName}</td>
                  <td className="py-3 font-mono tabular-nums">${formatUsd(r.amount)}</td>
                  <td className="py-3 font-mono tabular-nums text-muted">${formatUsd(r.feeMicro)}</td>
                  <td className="py-3 font-mono text-xs text-subtle">{shortHash(r.txHash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
