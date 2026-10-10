# Mandate

Policy wallets for the agent economy, built for the Tempo track at [Crypto World's Fair](https://colosseum.com/worldsfair).

Companies issue spend mandates. Agents pay APIs over the [Machine Payments Protocol](https://mpp.dev). Finance sees a ledger, not fifty hot wallets.

> Mandate issues policy-bound spend authorizations so AI agents can pay APIs on Tempo without holding the company treasury.

The finance console is an in-browser Tempo simulator. It uses the same typed errors as [`contracts/src/MandateBook.sol`](contracts/src/MandateBook.sol). Judges can run the failure path with no wallet. The Solidity contract is the on-chain policy; the console is not yet wired to a deployed address.

## Try the demo

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:8080/console](http://127.0.0.1:8080/console) and click **Run judge walkthrough**.

1. Finance has already issued Mandate #1: $50 cap, $10 per hour, empty merchant allowlist.
2. Helios requests a $0.40 research brief. The request returns HTTP 402, then `pay()` reverts `MerchantNotAllowed`. No funds move.
3. Finance allowlists that merchant. Helios retries. Tempo settles on a payment lane and the merchant returns 200 with a receipt.
4. Helios requests Shadow LLM, which was never listed. The policy holds.

That revert is the product. An empty allowlist cannot pay anyone.

Other pages:

| Path | What it is |
|---|---|
| `/` | Product overview |
| `/console` | Treasury, mandates, agent lab, HTTP trace, CSV ledger |
| `/architecture` | Control plane, MPP flow, Tempo addresses |
| `/submit` | Pitch script and judging notes |

The console keeps state in memory. A refresh resets the demo. If port 8080 is already taken, stop the other process before `npm run dev`. A cached page from an old server on that port can hide the app until you hard-refresh.

## What a mandate allows

Finance owns the treasury. An agent key can only call `pay`.

| Check | Revert |
|---|---|
| Unknown id | `UnknownMandate` |
| Caller is not the spender | `NotSpender` |
| Paused or closed | `MandatePaused`, `MandateClosed` |
| Outside the validity window | `MandateNotYetValid`, `MandateExpired` |
| Merchant missing from the allowlist | `MerchantNotAllowed` |
| Over the lifetime cap | `CapExceeded` |
| Over the rate window | `RateLimited` |
| Shared treasury cannot cover the amount | `InsufficientTreasury` |

`remaining` is a policy cap over a shared TIP-20 balance, not a separate escrow. Closing a mandate does not refund the treasury. Finance withdraws unused funds with `withdraw`.

Amounts are TIP-20 base units. Decimals are always 6, so $1.00 is `1000000` and the $0.40 demo charge is `400000`.

## Repository

```text
contracts/          MandateBook.sol, Foundry tests, deploy script
sdk/                ABI fragments and Tempo constants, no runtime dependencies
src/lib/tempo/      Browser policy engine, fees, and MPP 402 flow
src/routes/         Overview, console, architecture, submission kit
src/components/     Finance console
```

The browser engine in [`src/lib/tempo/mandate.ts`](src/lib/tempo/mandate.ts) is a 1:1 policy port of the Solidity `pay` checks. Settlement in the demo is simulated. On Tempo, `pay` calls TIP-20 `transferWithMemo`. The 32-byte memo is the MPP challenge id, so a receipt joins to an HTTP request without a side database.

## Tests

Policy engine, no chain:

```bash
node --experimental-strip-types --test src/lib/tempo/mandate.test.ts
```

Contract tests, no RPC. Requires [Foundry](https://book.getfoundry.sh/getting-started/installation) and Solidity 0.8.24. `contracts/lib/forge-std` is vendored.

```bash
cd contracts
forge test -vvv
```

Covered paths include an empty allowlist, a non-spender, pause, close, expiry, cap, rate limit, window reset, and deposit/withdraw.

## Tempo

| | Mainnet | Testnet (Moderato) |
|---|---|---|
| Chain id | 4217 | 42431 |
| RPC | `https://rpc.tempo.xyz` | `https://rpc.moderato.tempo.xyz` |
| Explorer | [explore.tempo.xyz](https://explore.tempo.xyz) | [explore.testnet.tempo.xyz](https://explore.testnet.tempo.xyz) |

| Contract | Address |
|---|---|
| pathUSD | `0x20c0000000000000000000000000000000000000` |
| TIP-20 Factory | `0x20Fc000000000000000000000000000000000000` |
| Fee Manager | `0xfeec000000000000000000000000000000000000` |

There is no native gas token. Fees are paid in a USD TIP-20. Eligible transfers use payment lanes (reserved blockspace, about 0.6s finality). A `pay()` in this model is about 84k gas, near $0.001 at the fee cap. Transaction type `0x76` lets finance sponsor gas with `feePayer`, so the agent wallet can stay empty.

Deploy and cast examples: [`contracts/README.md`](contracts/README.md). Use [Foundry for Tempo](https://tempo.xyz/developers/docs/sdk/foundry) when broadcasting. Pass `--tempo.fee-token` set to pathUSD. Do not put a private key in the repo.

```bash
cd contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://rpc.moderato.tempo.xyz \
  --tempo.fee-token 0x20c0000000000000000000000000000000000000 \
  --sender 0xYOUR_ADDRESS \
  --interactive \
  --broadcast \
  --verify
```

The deployer becomes `owner`.

## Deployed Contract

* **Network:** Tempo Moderato Testnet
* **Chain ID:** `42431`
* **Contract:** [MandateBook](https://explore.testnet.tempo.xyz/address/0xbe8731569E5A5460C1a27bd5DAA280157b3eD353?tab=contract)
* **Contract transactions:** [View on Tempo Explorer](https://explore.testnet.tempo.xyz/address/0xbe8731569E5A5460C1a27bd5DAA280157b3eD353?tab=transactions&order=desc)

The finance console is a browser-based simulation for judges to explore the spending-control workflow without installing a wallet. It demonstrates the corresponding policy rules but is not yet directly connected to the deployed contract. The Solidity contract provides the on-chain implementation.


## Stack

React 19, TanStack Start, Tailwind 4. Contract: Solidity 0.8.24, Foundry, `via_ir`, Cancun.

## License

[`contracts/src/MandateBook.sol`](contracts/src/MandateBook.sol) is Apache-2.0.
