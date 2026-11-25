# Mandate

**Policy Wallets for the Agent Economy, Built on Tempo.**

Mandate gives companies programmable spending controls for AI agents. Finance funds and governs a shared treasury; agents receive narrowly scoped spending authority instead of holding company treasury keys.

Built for the [Crypto World's Fair](https://colosseum.com/worldsfair) Tempo track.

> Mandate lets AI agents pay APIs while enforcing finance-defined spending limits, merchant permissions, and rate limits on-chain.

## Project Status

Mandate combines an on-chain spending-policy contract with an HTTP 402 Machine Payments Protocol (MPP) merchant integration and a protected Relayer.

| Component | Status | Description |
|---|---|---|
| Browser finance console | Demo / simulation | Explore treasury policies, mandates, agent behavior, and failure paths |
| Solidity MandateBook V2 | Deployed | Deployed on Tempo Moderato testnet |
| MPP merchant endpoints | Deployed and tested | Helios and Atlas HTTP 402 payment challenges |
| Relayer GET API | Deployed and verified | Reads live V2 contract state |
| Relayer POST API | Deployed and tested | Submits real on-chain payments for valid MPP challenges |
| Helios payment E2E | Verified, 2026-11-25 | Real payment, on-chain settlement verification, HTTP 200 paid-resource delivery, and Payment-Receipt |

The browser console is a demonstration environment. Its simulated state is separate from the deployed V2 contract and production API.

The verified payment E2E below was executed on Tempo Moderato testnet. It is not a browser simulation and does not imply Tempo Mainnet deployment or production-scale reliability.

## Verified Helios Payment E2E

A complete Helios payment flow was successfully verified on Tempo Moderato testnet on 2026-11-25.

The test covered:

1. Creating a real Helios MPP payment challenge.
2. Validating the challenge configuration.
3. Submitting a real on-chain payment through the Relayer.
4. Waiting for transaction confirmation.
5. Verifying the transaction receipt and settlement.
6. Submitting the payment authorization to the merchant endpoint.
7. Verifying the matching challenge and on-chain payment.
8. Returning the protected resource with HTTP 200 and a Payment-Receipt header.

### Transaction Evidence

| Evidence | Result |
|---|---|
| Resource | Helios Research API |
| Challenge ID | `mpp_helios_be298a956bb84b3784daf568be912ce6` |
| Challenge memo | `0x39ea9180b9768bb8bee9f0702225044e12ec162930436a499289da5da27843cc` |
| Chain | Tempo Moderato |
| Chain ID | `42431` |
| Mandate ID | `1` |
| Contract | `0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De` |
| Spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449E74` |
| Merchant | `0x0253F2c64145E9CBB605Be8cbFc99B08E2E55438` |
| Token | Moderato pathUSD |
| Amount | `0.40 PATH_USD` |
| Base units | `400000` |
| Relayer response | HTTP `200` |
| Relayer outcome | `confirmed` |
| Reverted | `false` |
| Transaction hash | `0x67806d9bdfc2ebab0d3458c72202d411e94544428b4adb82852159db13ffe4a6` |
| Block | `45864838` |
| Gas used | `333934` |
| Merchant response | HTTP `200` |
| Payment-Receipt | Returned successfully |
| Settlement | `ok: true` |

[View the successful payment on Tempo Explorer](https://explore.testnet.tempo.xyz/tx/0x67806d9bdfc2ebab0d3458c72202d411e94544428b4adb82852159db13ffe4a6)

### Delivered Resource

The merchant returned the protected Helios Research API resource:

```json
{
  "signal": "SOL/USDC orderbook imbalance +2.4 sigma",
  "confidence": 0.91,
  "source": "Helios Live Feed"
}
```

The merchant also returned a `Payment-Receipt` header containing:

- Payment method: `tempo`
- Chain ID: `42431`
- Confirmed transaction hash
- Block number: `45864838`
- Matching challenge ID

The merchant's successful response establishes that the tested payment was not merely submitted on-chain: the corresponding paid resource was also delivered.

An earlier test transaction on the same date was confirmed on-chain, but its subsequent merchant verification request arrived after the five-minute challenge expiry. It did not deliver the resource and is not counted as a successful E2E.

This evidence establishes the tested Helios path only. It does not establish Tempo Mainnet deployment, production-scale reliability, independent customer adoption, or successful E2E for every merchant/resource.

## Architecture

```text
                         Finance
                            |
                 Deposit / Configure
                            |
                            v
                 +--------------------+
                 |  MandateBook V2    |
                 |  Tempo Moderato    |
                 +--------------------+
                            |
                   On-chain policy
                            |
                +-----------+-----------+
                |                       |
                v                       v
             Helios                   Atlas
                |                       |
                +-----------+-----------+
                            |
                       HTTP request
                            |
                            v
                  MPP HTTP 402 Challenge
                            |
                            v
                       Agent / Client
                            |
                   Submit challenge ID
                            |
                            v
                    Protected Relayer
                            |
                   Validate challenge
                   Validate merchant
                   Validate amount
                   Validate mandate
                            |
                            v
                    MandateBook.pay()
                            |
                            v
                  Tempo TIP-20 transfer
                    transferWithMemo
                            |
                            v
                  On-chain Paid event
                            |
                            v
                 Verify receipt and memo
                            |
                            v
                 Merchant verifies payment
                            |
                            v
                  HTTP 200 + paid resource
```

The on-chain contract is the authoritative spending-policy enforcement layer.

The server-side MPP integration creates payment challenges and verifies settlement. The Relayer can submit on-chain payments using its configured server-side account.

## Try the Browser Demo

Requirements:

- Node.js 20 or newer

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:8080/console
```

Click **Run judge walkthrough**.

The walkthrough demonstrates:

1. Finance issues a sample Mandate #1.
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

## Live Tempo Deployment

### Tempo Moderato Testnet

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

**The current Mandate V2 deployment is on Moderato testnet, not Tempo Mainnet.**

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

### V2 Operational Addresses

| Role | Address |
|---|---|
| Finance / Treasury wallet | `0x0253F2c64145E9CBB605Be8cbFc99B08E2E55438` |
| Authorized Relayer / Agent spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449E74` |

The Helios and Atlas merchant integrations currently share the same finance wallet address. Consequently, Mandate #1 has one unique merchant allowlist entry.

No private keys, wallet secrets, or API credentials are included in this documentation.

## Mandate #1 — Deployed Policy

Mandate #1 is configured on the V2 contract.

| Parameter | Configured value |
|---|---:|
| Mandate ID | `1` |
| Token | pathUSD |
| Spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449E74` |
| Initial lifetime spending cap | 100 PATH_USD |
| Initial maximum per transaction | 1 PATH_USD |
| Rate limit | 5 PATH_USD |
| Rate-limit window | 3600 seconds |
| Merchant allowlist entries | 1 unique wallet |
| Paused | `false` at the recorded configuration check |
| Closed | `false` at the recorded configuration check |
| Department hash | `0xb77bf3b810235a918879a4b239ef948ceff141ffc95e62ec01430ae43fd45f07` |

The V2 treasury was initially funded with 200 PATH_USD.

The earlier read-only verification recorded:

- 100 PATH_USD reserved by Mandate #1.
- 100 PATH_USD unencumbered.
- 0 PATH_USD spent at that time.
- Mandate #1 neither paused nor closed.

The successful Helios payment documented above subsequently spent 0.40 PATH_USD. A separate earlier test payment was also confirmed on-chain for 0.40 PATH_USD, although its merchant challenge expired before resource delivery.

Therefore, the earlier 100 PATH_USD remaining figure is historical and must not be treated as the current live allowance.

Amounts use pathUSD's 6 decimal places:

```text
1 PATH_USD    = 1000000 base units
0.40 PATH_USD =  400000 base units
0.08 PATH_USD =   80000 base units
```

For current balances and allowance, query the protected Relayer GET endpoint or the deployed contract.

## On-Chain Permission Model

MandateBook V2 separates ownership, treasury administration, policy administration, and emergency control.

| Role | Responsibility |
|---|---|
| `owner` | Owns the contract and manages owner-controlled roles |
| `treasuryAdmin` | Deposits and withdraws treasury funds |
| `policyOperators` | Issues, tops up, configures, pauses/unpauses, and closes mandates |
| `emergencyGuardian` | Can pause a mandate as an emergency action |
| Mandate `spender` | Can call `pay()` only within the mandate's policy |

Important permission boundaries:

- Agents do not own the treasury.
- A spender cannot withdraw treasury funds.
- A spender cannot change merchant permissions or mandate limits.
- A policy operator cannot spend unless its address is also the mandate's authorized spender.
- An emergency guardian can pause but cannot unpause unless it also has policy-operator permission.
- The owner can manage delegated roles; delegated permissions are distinct from the mandate's spender permission.

Do not treat the browser demo's simulated roles as proof of the deployed contract's current role assignments.

## MPP Merchant Endpoints

The deployed server exposes separate MPP payment endpoints for Helios and Atlas.

| Merchant | Endpoint | Challenge amount |
|---|---|---:|
| Helios | `/api/mpp/helios` | 0.40 PATH_USD |
| Atlas | `/api/mpp/atlas` | 0.08 PATH_USD |

A normal GET request without a Payment Authorization header returns HTTP `402 Payment Required` and creates a payment challenge.

Examples:

```bash
curl -i https://YOUR_HOST/api/mpp/helios
```

```bash
curl -i https://YOUR_HOST/api/mpp/atlas
```

Replace `YOUR_HOST` with the actual deployed hostname.

The challenge identifies the configured Tempo network, V2 contract, mandate, spender, merchant, token, amount, challenge ID, and memo.

Expected challenge configuration:

| Field | Value |
|---|---|
| Chain ID | `42431` |
| Mandate ID | `1` |
| Contract | `0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De` |
| Spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449E74` |
| Helios amount | `400000` base units |
| Atlas amount | `80000` base units |
| Token | Moderato pathUSD |

HTTP 402 is the expected challenge response. It is not an application failure and does not itself mean that a payment has been made.

### MPP Request and Settlement Sequence

The merchant route is:

```text
GET /api/mpp/$resource
```

Supported resource keys include `helios`, `atlas`, and `shadow`. The production demo endpoints documented above are Helios and Atlas.

The sequence is:

1. The client sends a GET request without a Payment Authorization header.
2. The server validates the resource configuration and applies a shared rate limit.
3. The server creates a unique challenge ID and derives its 32-byte memo.
4. The server stores the challenge and returns HTTP 402 with a `WWW-Authenticate` payment challenge.
5. The client or Relayer submits the payment on Tempo using the challenge's mandate, merchant, amount, and memo.
6. The client retries the original resource request with a Payment Authorization header containing the Tempo transaction hash and challenge ID.
7. The merchant server loads the stored challenge and checks that its configuration still matches the expected resource, contract, chain, token, merchant, amount, and spender.
8. The server verifies the transaction receipt, successful status, matching `MandateBook.Paid` event, exact payment fields, and on-chain `settledMemos` state.
9. The server atomically records redemption and the payment receipt in the database.
10. Only after successful verification does the endpoint return HTTP 200 with the protected resource and a `Payment-Receipt` header.

A challenge expires after five minutes. A missing, expired, mismatched, or already redeemed challenge is rejected.

### Payment Authorization Format

The route expects a Tempo Payment Authorization header with:

- `method="tempo"`
- A 32-byte transaction hash in `txHash`
- The resource-specific `challengeId`

The parser rejects malformed headers, duplicate parameters, invalid transaction hashes, and challenge IDs that do not match the requested resource.

A valid header must refer to an actual on-chain transaction that satisfies the challenge.

## Relayer API

The protected endpoint is:

```text
/api/relayer/action
```

Both GET and POST require the configured Bearer authorization credential. POST requests are rate-limited. Responses use no-store cache headers.

Never place the Relayer API credential in browser code, public examples, screenshots, or source control.

### GET — Read Live Contract State

```http
GET /api/relayer/action
Authorization: Bearer YOUR_RELAYER_API_KEY
```

The GET handler reads the configured Moderato RPC and returns:

- Chain ID
- Contract address
- Current block number
- Unencumbered pathUSD treasury balance
- Total reserved amount for pathUSD
- Merchant allowlist count
- Mandate ID and spender
- Token address
- `spendMax` and `remaining`
- `maxPerTx`
- Validity timestamps
- `rateLimit`, `window`, `windowSpent`, and `windowStart`
- `paused`, `closed`, and department hash

The GET handler is read-only. It does not submit a blockchain transaction.

### POST — Execute a Challenge Payment

The POST handler accepts the `pay_challenge` action.

Example request shape:

```http
POST /api/relayer/action
Authorization: Bearer YOUR_RELAYER_API_KEY
Content-Type: application/json
```

```json
{
  "action": "pay_challenge",
  "challengeId": "mpp_helios_REPLACE_WITH_REAL_CHALLENGE_ID"
}
```

Use a real, unexpired challenge ID returned by the MPP endpoint. The example above is illustrative only.

Before submitting a transaction, the Relayer checks:

- The challenge exists and has not expired.
- The challenge belongs to the configured demo mandate.
- The challenge chain is Tempo Moderato, Chain ID `42431`.
- The challenge contract matches the configured MandateBook address.
- The token is Moderato pathUSD.
- The challenge spender matches the address derived from the configured Relayer private key.
- The resource is supported.
- The challenge merchant matches the server-configured merchant address.
- The challenge amount exactly matches the configured resource price.
- The challenge memo has not already been settled on-chain.

The Relayer then simulates `MandateBook.pay()`, submits the transaction, waits for its receipt, checks the matching `Paid` event, and confirms `settledMemos`.

The POST handler has an in-process in-flight guard for concurrent requests using the same challenge ID. The contract's on-chain `settledMemos` mapping is the durable duplicate-settlement protection.

### POST Response Codes

The following table describes the documented implementation behavior.

| HTTP status | Outcome / condition | Meaning |
|---|---|---|
| `200` | `confirmed` | Payment transaction succeeded and the expected `Paid` event and `settledMemos` state were verified |
| `400` | Invalid request / validation error | Invalid JSON body, unsupported action, invalid challenge ID, expired challenge, configuration mismatch, or a policy revert detected before broadcast |
| `401` | Unauthorized | Missing or invalid Bearer authorization credential |
| `403` | Forbidden | Challenge mandate ID or expected spender does not match the configured Relayer |
| `404` | Challenge not found | The challenge ID does not exist in challenge storage |
| `409` | Conflict | Challenge is already being processed or its memo is already settled on-chain |
| `429` | Rate limited | The Relayer POST request exceeded the configured shared rate limit |
| `502` | `reverted` | A broadcast transaction was mined with a reverted receipt |
| `502` | `verification_failed` | The transaction succeeded, but the expected event or memo state could not be verified |
| `202` | `unknown` | A transaction hash exists, but confirmation or verification is unavailable |
| `503` | Service unavailable / unknown | Relayer configuration is unavailable or submission outcome cannot be determined |

The GET endpoint also requires Bearer authorization. It returns `401` for missing or invalid authorization and `503` if the live state cannot be retrieved.

Important transaction handling:

- A `202` response means the transaction was broadcast. It does not mean the transaction failed.
- A `502 / reverted` response means a transaction was mined and reverted. Check its transaction hash and receipt.
- A `502 / verification_failed` response means the transaction succeeded, but the application could not verify the expected event or memo state. Do not submit another payment blindly.
- A `503` response can represent an uncertain submission outcome. Check server logs and on-chain state before retrying.
- A `400` policy revert detected before broadcast does not represent a successful payment.

The POST route submits a real testnet transaction when successfully invoked. Do not call it casually against a live challenge.

## On-Chain Spending Policy

Finance funds the shared TIP-20 treasury and configures mandates. An agent can spend only through the mandate's authorized spender address.

The contract checks the following conditions during `pay()`:

| Condition | Revert |
|---|---|
| Mandate ID does not exist | `UnknownMandate` |
| Caller is not the mandate spender | `NotSpender` |
| Mandate is paused | `MandatePaused` |
| Mandate is closed | `MandateClosed` |
| Mandate is not yet valid | `MandateNotYetValid` |
| Mandate has expired | `MandateExpired` |
| Merchant is not allowlisted | `MerchantNotAllowed` |
| Amount is zero | `ZeroAmount` |
| Amount exceeds `maxPerTx` | `PerTxLimitExceeded` |
| Challenge memo has already settled | `ChallengeAlreadySettled` |
| Lifetime remaining allowance is insufficient | `CapExceeded` |
| Rate limit would be exceeded | `RateLimited` |
| Actual treasury balance cannot cover reserved obligations and payment | `InsufficientTreasury` |

Additional validation and authorization errors include:

| Condition | Revert |
|---|---|
| Unauthorized owner-only operation | `NotOwner` |
| Caller is not treasury administrator | `NotTreasuryAdmin` |
| Caller is not a policy operator | `NotPolicyOperator` |
| Caller is neither guardian nor policy operator | `NotGuardianOrOperator` |
| Zero address supplied | `ZeroAddress` |
| Invalid spend cap | `InvalidSpendMax` |
| Invalid validity range | `InvalidValidityRange` |
| Rate limit configured with a zero-length window | `InvalidWindow` |
| Treasury withdrawal would consume reserved funds | `ExceedsUnencumberedBalance` |

The Solidity source is authoritative for the complete current error definitions.

### Treasury Reservation Model

`remaining` is a policy allowance backed by the shared TIP-20 treasury. It is not a separate escrow balance.

When a mandate is issued, its spending cap is reserved against the treasury's unencumbered balance. Successful payments reduce the mandate's remaining allowance and its reserved amount. Closing a mandate releases its unused reservation.

Treasury withdrawals are limited to unencumbered funds. A spender cannot withdraw treasury funds.

## Security Considerations

- Keep treasury administration separate from agent spending authority.
- Use a dedicated Relayer account with only the required permissions.
- Keep Relayer private keys and API credentials server-side.
- Do not expose secrets to browser clients.
- Do not authorize merchants by trusting client-supplied values.
- Validate challenge configuration against server-side resource configuration.
- Verify transaction receipts and `Paid` events before delivering paid resources.
- Check `settledMemos` before accepting a payment.
- Do not retry a transaction with an unknown broadcast outcome until its original transaction has been checked.
- Keep the merchant allowlist fail-closed.
- Do not withdraw reserved treasury funds.
- Do not confuse Tempo Mainnet with Tempo Moderato testnet.
- Do not treat a successful HTTP 402 challenge as proof of settlement.

## Evidence and Reproducibility

The successful Helios E2E evidence was archived on the deployment server.

Archive:

```text
/tmp/mandate-helios-e2e-evidence-20261125.tar.gz
```

SHA-256:

```text
722851a2a80df686ea94f1de23ae44ac82c55be7674f348023426a400637226a
```

The archive contains:

- `challenge.json`
- `challenge.headers`
- `payment.json`
- `payment.headers`
- `delivery.json`
- `delivery.headers`
- `EVIDENCE.md`

The archive is server-side evidence, not a repository file.

## Verification Status

Verified on Tempo Moderato testnet:

- V2 contract deployment and address.
- Mandate #1 configuration.
- Historical treasury reservation and unencumbered balance through read-only contract queries.
- Helios and Atlas HTTP 402 challenge responses.
- Protected Relayer GET response with live V2 state.
- Real Helios payment transaction confirmed on-chain.
- Relayer confirmation of the transaction.
- Successful merchant-side verification of the matching challenge and on-chain payment.
- Successful HTTP 200 paid-resource response.
- Successful `Payment-Receipt` response header.

The verified E2E result proves one successful Helios payment path on Tempo Moderato testnet. It does not prove Mainnet deployment, production-scale reliability, or independent customer adoption.

## License

[`MandateBook.sol`](contracts/src/MandateBook.sol) is licensed under Apache-2.0.
