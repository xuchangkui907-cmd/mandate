# Mandate

My Email:   xuchangkui907@gmail.com

**Policy wallets for the agent economy, built on Tempo.**

Mandate gives companies programmable spending controls for AI agents. Finance funds and governs a shared treasury; agents receive narrowly scoped spending authority instead of holding company treasury keys.

Built for the [Crypto World's Fair](https://colosseum.com/worldsfair) Tempo track.

> Mandate lets AI agents pay APIs while enforcing finance-defined spending limits, merchant permissions, and rate limits on-chain.

## Project status

Mandate has two distinct execution environments:

| Component | Status | Description |
|---|---|---|
| Browser finance console | Demo / simulation | Explore treasury policies, mandates, agent behavior, and failure paths without a wallet |
| Solidity MandateBook V2 | Deployed | Deployed to Tempo Moderato testnet |
| MPP merchant endpoints | Deployed and read-only verified | Helios and Atlas return HTTP 402 payment challenges |
| Relayer API | Deployed and read-only verified | Reads live V2 contract state |
| End-to-end payment settlement | Not yet fully verified | A complete real payment through the production API has not yet been confirmed |

The browser console is not a live on-chain finance dashboard. Its simulated state is separate from the deployed V2 contract and production API.

## Architecture

```text
                    Finance
                       |
                       | Deposit / Issue / Configure
                       v
              +--------------------+
              |  MandateBook V2    |
              |  Tempo Moderato    |
              +--------------------+
                       |
                       | On-chain spending policy
                       |
                 +-----+------+
                 |            |
                 v            v
              Helios        Atlas
                 |            |
                 +-----+------+
                       |
                       | HTTP request
                       v
                MPP HTTP 402
                       |
                       v
                Agent / Relayer
                       |
                       | Validate mandate
                       | Check merchant and limits
                       | Submit payment
                       v
              Tempo TIP-20 transfer
                       |
                       v
                 Payment receipt
```

The on-chain contract enforces the spending policy. The server-side MPP integration connects API payment requests to the mandate and relayer workflow.

## Try the browser demo

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:8080/console
```

Click **Run judge walkthrough**.

The walkthrough demonstrates the policy enforcement flow:

1. Finance has issued a sample Mandate #1.
2. Helios requests a $0.40 research brief.
3. The request returns HTTP 402.
4. An unapproved merchant is rejected by the policy.
5. After the merchant is allowlisted, the simulated flow can proceed.
6. A merchant that is not on the allowlist remains blocked.

The browser walkthrough is a local simulation. It does not submit transactions to the deployed V2 contract.

Other pages:

| Path | Description |
|---|---|
| `/` | Product overview |
| `/console` | Treasury, mandates, agent lab, HTTP trace, CSV ledger |
| `/architecture` | Architecture and Tempo integration |
| `/submit` | Project pitch and judging notes |

The console keeps demo state in memory. Refreshing the page resets the simulation.

## Live Tempo deployment

### Network

| Property | Value |
|---|---|
| Network | Tempo Moderato Testnet |
| Chain ID | `42431` |
| RPC | `https://rpc.moderato.tempo.xyz` |
| Explorer | [Tempo Testnet Explorer](https://explore.testnet.tempo.xyz) |
| Token | pathUSD |
| Token decimals | 6 |
| pathUSD address | `0x20C0000000000000000000000000000000000000` |

Tempo Mainnet is a separate network:

| Property | Value |
|---|---|
| Network | Tempo Mainnet |
| Chain ID | `4217` |
| RPC | `https://rpc.tempo.xyz` |
| Explorer | [Tempo Mainnet Explorer](https://explore.tempo.xyz) |

**The current Mandate V2 deployment described below is on Moderato testnet, not Tempo Mainnet.**

### MandateBook V2

| Property | Value |
|---|---|
| Contract | MandateBook V2 |
| Network | Tempo Moderato |
| Chain ID | `42431` |
| Contract address | `0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De` |
| Deployment block | `45829267` |
| Deployment transaction | [`0xd4f2041db4ddda2dcab234adb2e778726432665d7fb814c38ecab4b7d1b61a08`](https://explore.testnet.tempo.xyz/tx/0xd4f2041db4ddda2dcab234adb2e778726432665d7fb814c38ecab4b7d1b61a08) |
| pathUSD | `0x20C0000000000000000000000000000000000000` |

[View MandateBook V2 on Tempo Explorer](https://explore.testnet.tempo.xyz/address/0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De)

### V2 operational addresses

| Role | Address |
|---|---|
| Finance / Treasury wallet | `0x0253F2c64145eC9BB605Be8cbFc99B08E2E55438` |
| Authorized Relayer / Agent spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449e74` |

The Helios and Atlas merchant integrations currently share the same finance wallet address. Consequently, Mandate #1 has one unique merchant allowlist entry.

No private keys, wallet secrets, or API credentials are included in this repository documentation.

## Mandate #1 — deployed policy

Mandate #1 is configured on the V2 contract.

| Parameter | On-chain value |
|---|---:|
| Mandate ID | `1` |
| Token | pathUSD |
| Spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449e74` |
| Lifetime spending cap | 100 PATH_USD |
| Remaining allowance | 100 PATH_USD |
| Maximum per transaction | 1 PATH_USD |
| Rate limit | 5 PATH_USD |
| Rate-limit window | 3600 seconds |
| Merchant allowlist entries | 1 |
| Paused | `false` |
| Closed | `false` |
| Department hash | `0xb77bf3b810235a918879a4b239ef948ceff141ffc95e62ec01430ae43fd45f07` |

The V2 treasury was funded with 200 PATH_USD.

At the time of the production read-only verification:

- 100 PATH_USD was reserved by Mandate #1.
- 100 PATH_USD remained unencumbered.
- Mandate #1 had spent 0 PATH_USD.
- The mandate was neither paused nor closed.

Amounts are expressed in pathUSD, which uses 6 decimal places. For example:

```text
1 PATH_USD   = 1000000 base units
0.40 PATH_USD = 400000 base units
0.08 PATH_USD =  80000 base units
```

## MPP merchant endpoints

The deployed server exposes separate MPP payment endpoints for Helios and Atlas.

| Merchant | Endpoint | Challenge amount |
|---|---|---:|
| Helios | `/api/mpp/helios` | 0.40 PATH_USD |
| Atlas | `/api/mpp/atlas` | 0.08 PATH_USD |

A normal GET request returns HTTP `402 Payment Required` with a payment challenge.

Example:

```bash
curl -i https://YOUR_HOST/api/mpp/helios
```

```bash
curl -i https://YOUR_HOST/api/mpp/atlas
```

The challenge identifies the configured Tempo network, V2 contract, mandate, spender, merchant, and payment amount.

The expected challenge configuration is:

| Field | Value |
|---|---|
| Chain ID | `42431` |
| Mandate ID | `1` |
| Contract | `0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De` |
| Spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449e74` |
| Helios amount | `400000` base units |
| Atlas amount | `80000` base units |

HTTP 402 is the expected challenge response. It is not an application failure.

## Relayer API

The server also exposes a protected Relayer API.

The read endpoint:

```text
GET /api/relayer/action
```

requires the configured Bearer authorization credential.

It returns live information read from the deployed V2 contract, including:

- Chain ID and contract address
- Current block number
- Unencumbered treasury balance
- Amount reserved by mandates
- Merchant allowlist count
- Mandate #1 spending limits and status

The API must be called with the server-side credential. Never place the Relayer API key in browser code, public examples, screenshots, or source control.

The production read-only verification returned the expected V2 contract address, Mandate #1 configuration, and treasury balances.

## Spending policy

Finance owns and funds the treasury. An agent key is authorized only to spend through the mandate.

The contract checks:

| Condition | Result |
|---|---|
| Unknown mandate ID | `UnknownMandate` |
| Caller is not the authorized spender | `NotSpender` |
| Mandate is paused | `MandatePaused` |
| Mandate is closed | `MandateClosed` |
| Mandate is not yet valid | `MandateNotYetValid` |
| Mandate has expired | `MandateExpired` |
| Merchant is not allowlisted | `MerchantNotAllowed` |
| Lifetime cap would be exceeded | `CapExceeded` |
| Rate limit would be exceeded | `RateLimited` |
| Shared treasury cannot cover payment | `InsufficientTreasury` |

`remaining` is a policy allowance against the shared TIP-20 treasury. It is not a separate escrow balance.

Closing a mandate does not automatically refund the treasury. Finance controls treasury withdrawals through the contract.

## MPP settlement model

Machine Payments Protocol allows a merchant to request payment through HTTP 402.

The intended payment flow is:

1. An agent requests a paid API resource.
2. The merchant returns an HTTP 402 payment challenge.
3. The payment client processes the challenge.
4. The payment is checked against the mandate's on-chain policy.
5. The authorized payment is submitted through the Tempo integration.
6. The merchant verifies the payment result before returning the protected resource.

The contract uses TIP-20 `transferWithMemo`. The 32-byte memo carries the MPP challenge ID, allowing the on-chain payment record to be associated with the HTTP request.

The server includes payment challenge handling and duplicate-payment protection using settled memo tracking.

**Verification boundary:** production HTTP 402 challenges and read-only V2 contract queries have been verified. A complete real payment submission, on-chain settlement, and successful paid-resource response have not yet been confirmed as an end-to-end production test. Do not interpret a successful HTTP 402 challenge or a successful read-only Relayer response as proof that a real payment has settled.

## Historical V1 deployment

The original V1 contract remains a historical deployment.

| Property | Value |
|---|---|
| Contract | MandateBook V1 |
| Network | Tempo Moderato Testnet |
| Chain ID | `42431` |
| Historical contract address | `0xbe8731569E5A5460C1a27bd5DAA280157b3eD353` |
| Historical owner | `0xc97d95982AD8E3DaC45b3A14402745096E2dA206` |

V1 is not the active V2 contract.

The V1 deployment, owner, historical data, and existing balance have been preserved. V1 funds and mandate state have not been migrated into V2.

Do not confuse the V1 contract address with the current V2 deployment.

## Repository layout

```text
contracts/
  src/
    MandateBook.sol
  script/
    DeployModerato.s.sol
  test/
  README.md

sdk/
  ABI fragments and Tempo constants

src/
  lib/tempo/
    Browser policy engine and MPP flow
  routes/
    Product pages and API routes
  components/
    Finance console
```

The browser policy engine is a local demonstration of the Solidity spending rules. The deployed contract is the authoritative on-chain policy.

## Tests

### Browser policy engine

```bash
node --experimental-strip-types --test src/lib/tempo/mandate.test.ts
```

### Solidity contract tests

Requires Foundry and Solidity 0.8.24.

```bash
cd contracts
forge test -vvv
```

The test suite covers policy enforcement, including merchant allowlisting, spender authorization, pause and close behavior, validity windows, lifetime caps, rate limits, and treasury operations.

## Deployment notes

The current V2 deployment is already deployed to Tempo Moderato.

The deployment command below is provided for reproducibility and future deployments. It is not a request to redeploy the existing production contract.

```bash
cd contracts

forge script script/DeployModerato.s.sol:DeployMandateBookModerato \
  --rpc-url https://rpc.moderato.tempo.xyz \
  --tempo.fee-token 0x20c0000000000000000000000000000000000000 \
  --broadcast \
  --verify
```

Set `DEPLOYER_PRIVATE_KEY` in the process environment before broadcasting. Never commit private keys or `.env` files.

The deployer becomes the contract owner. Review the script and deployment parameters before using it.

## Technology stack

- React 19
- TanStack Start
- Tailwind CSS 4
- Solidity 0.8.24
- Foundry
- Tempo TIP-20
- Machine Payments Protocol (MPP)

## License

[`contracts/src/MandateBook.sol`](contracts/src/MandateBook.sol) is licensed under Apache-2.0.

My Email:   xuchangkui907@gmail.com
