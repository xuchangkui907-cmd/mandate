
# Mandate

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
| MPP merchant endpoints | Deployed; HTTP 402 challenge verified | Helios and Atlas return payment challenges |
| Relayer GET API | Deployed; read-only verified | Reads live V2 contract state |
| Relayer POST API | Implemented | Can submit a real on-chain payment for a valid MPP challenge |
| Complete production payment E2E | Not yet fully verified | A complete real payment through the production API, followed by a successful paid-resource response, has not yet been confirmed |

The browser console is not a live on-chain finance dashboard. Its simulated state is separate from the deployed V2 contract and production API.

A deployed API implementation is not proof that a real payment has successfully settled. The payment E2E status above is intentionally conservative.

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

The on-chain contract is the authoritative spending-policy enforcement layer. The server-side MPP integration creates payment challenges and verifies settlement. The Relayer can submit the on-chain payment using its configured server-side account.

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

Amounts are expressed in pathUSD, which uses 6 decimal places.

```text
1 PATH_USD    = 1000000 base units
0.40 PATH_USD =  400000 base units
0.08 PATH_USD =   80000 base units
```

These figures describe the state at the time of verification. They are not a guarantee that the live balances remain unchanged.

## On-chain permission model

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

The contract uses role checks on privileged operations. Do not treat the browser demo's simulated roles as proof of the deployed contract's current role assignments.

## MPP merchant endpoints

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

The expected challenge configuration is:

| Field | Value |
|---|---|
| Chain ID | `42431` |
| Mandate ID | `1` |
| Contract | `0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De` |
| Spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449e74` |
| Helios amount | `400000` base units |
| Atlas amount | `80000` base units |
| Token | Moderato pathUSD |

HTTP 402 is the expected challenge response. It is not an application failure and does not itself mean that a payment has been made.

### MPP request and settlement sequence

The implemented merchant route is:

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

### Payment Authorization format

The route expects a Tempo Payment Authorization header with:

- `method="tempo"`
- a 32-byte transaction hash in `txHash`
- the resource-specific `challengeId`

The parser rejects malformed headers, duplicate parameters, invalid transaction hashes, and challenge IDs that do not match the requested resource.

Do not invent a successful Payment Authorization header or reuse a transaction hash from another challenge. A valid header must refer to an actual on-chain transaction that satisfies the challenge.

## Relayer API

The server exposes a protected Relayer endpoint:

```text
/api/relayer/action
```

Both GET and POST require the configured Bearer authorization credential. POST requests are rate-limited. Responses use no-store cache headers.

Never place the Relayer API credential in browser code, public examples, screenshots, or source control.

### GET — read live contract state

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

### POST — execute a challenge payment

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

Use a real, unexpired challenge ID returned by the MPP endpoint. The example above is a shape illustration, not a valid challenge.

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

#### POST response codes

The following table reflects the current implementation in `src/routes/api/relayer/action.ts` and `src/lib/mpp/relayer-auth.ts`.

| HTTP status | Outcome / condition | Meaning |
|---|---|---|
| `200` | `confirmed` | Payment transaction succeeded and the expected `Paid` event and `settledMemos` state were verified |
| `400` | Invalid request / validation error | Invalid JSON body, unsupported action, invalid challenge ID, expired challenge, chain/contract/token/resource/merchant/amount mismatch, or a contract policy revert detected before broadcast |
| `401` | Unauthorized | Missing or invalid Bearer authorization credential |
| `403` | Forbidden | Challenge mandate ID or expected spender does not match the configured Relayer |
| `404` | Challenge not found | The challenge ID does not exist in challenge storage |
| `409` | Conflict | The challenge is already being processed or its memo is already settled on-chain |
| `429` | Rate limited | The Relayer POST request exceeded the configured shared rate limit |
| `502` | `reverted` | A broadcast transaction was mined with a reverted receipt |
| `502` | `verification_failed` | The transaction succeeded, but the expected `MandateBook.Paid` event or `settledMemos` state could not be verified |
| `202` | `unknown` | A transaction hash exists, but confirmation or verification is unavailable; inspect the transaction before retrying |
| `503` | Service unavailable / unknown | Relayer configuration is unavailable, an error occurred before a transaction hash was obtained, or the server could not determine whether submission occurred |

The GET endpoint also requires Bearer authorization. It returns `401` for missing or invalid authorization and `503` if the live state cannot be retrieved.

**Important transaction handling:**

- A `202` response means the transaction was broadcast. It does not mean the transaction failed.
- A `502 / reverted` response means a transaction was mined and reverted. Check its transaction hash and receipt.
- A `502 / verification_failed` response means the transaction succeeded, but the application could not verify the expected event or memo state. Do not submit another payment blindly.
- A `503` response can represent an uncertain submission outcome. Check server logs and on-chain state before retrying.
- A `400` policy revert detected before broadcast does not represent a successful payment.

The POST route submits a real testnet transaction when successfully invoked. Do not call it casually against a live challenge.

## On-chain spending policy

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
| Challenge memo has already settled for the mandate | `ChallengeAlreadySettled` |
| Lifetime remaining allowance is insufficient | `CapExceeded` |
| Rate limit would be exceeded | `RateLimited` |
| Actual treasury balance cannot cover reserved obligations and payment | `InsufficientTreasury` |

The contract also validates inputs and privileged operations. Relevant additional errors include:

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

The contract contains additional mandate and treasury validation errors. The Solidity source is authoritative for the complete current error definitions.

### Treasury reservation model

`remaining` is a policy allowance backed by the shared TIP-20 treasury. It is not a separate escrow balance.

When a mandate is issued, its spending cap is reserved against the treasury's unencumbered balance. Successful payments reduce the mandate's remaining allowance and its reserved amount. Closing a mandate releases its unused reservation.

Treasury withdrawals are limited to unencumbered funds. A spender cannot withdraw treasury funds.

### Replay protection

Each payment includes a 32-byte memo derived from the MPP challenge ID.

The contract records:

```solidity
settledMemos[mandateId][memo]
```

A second payment using the same mandate and memo reverts with `ChallengeAlreadySettled`.

The server also checks transaction hashes and challenge IDs against its redemption records and uses an atomic database commit to prevent concurrent duplicate redemption.

These protections operate at different layers:

- On-chain `settledMemos`: prevents duplicate settlement for a mandate and memo.
- Server redemption records: prevents reusing a transaction hash or challenge ID across HTTP verification attempts.
- Relayer in-flight guard: prevents simultaneous duplicate processing inside one server process.

## MPP settlement model

The on-chain payment operation is:

```solidity
pay(uint256 id, address merchant, uint128 amount, bytes32 memo)
```

The contract calls the configured TIP-20 token's:

```solidity
transferWithMemo(merchant, amount, memo)
```

The memo links the on-chain payment to the original HTTP payment challenge.

The MPP verifier checks:

1. Challenge chain ID and contract binding.
2. Challenge memo derivation.
3. Challenge expiration.
4. Whether the transaction hash or challenge ID was already redeemed.
5. RPC chain ID.
6. Transaction receipt status.
7. A matching `MandateBook.Paid` event emitted by the configured contract.
8. Exact mandate ID, spender, merchant, token, amount, and memo.
9. On-chain `settledMemos` state.
10. Atomic database redemption and receipt persistence.

Only after these checks succeed does the merchant route return the protected resource.

## Verification boundary

The following production checks were completed:

- V2 contract deployment and address identification.
- V2 configuration and Mandate #1 read-only state.
- Treasury reservation and unencumbered balance read-only checks.
- Helios and Atlas HTTP 402 challenge responses.
- Protected Relayer GET endpoint returning live V2 state.

The following has **not** yet been confirmed as a complete production end-to-end test:

- A real MPP challenge payment submitted through the production Relayer POST endpoint.
- Successful on-chain settlement for that challenge.
- Successful second merchant request with Payment Authorization.
- HTTP 200 delivery of the paid resource and a verified `Payment-Receipt`.

Do not describe the project as having completed a successful production payment E2E until that full sequence has been observed.

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
    interfaces/
      ITIP20.sol
  script/
    DeployModerato.s.sol
  test/
    MandateBook.t.sol
  README.md

sdk/
  ABI fragments and Tempo constants

src/
  lib/
    mpp/
      Challenge persistence, authorization, verification
    tempo/
      Tempo configuration and browser policy logic
  routes/
    api/
      mpp/
      relayer/
  components/
    Finance console
```

The browser policy engine is a local demonstration of the Solidity spending rules. The deployed contract is the authoritative on-chain policy.

## Tests

### Browser policy engine

```bash
node --experimental-strip-types --test src/lib/tempo/mandate.test.ts
```

### MPP and API tests

The repository includes focused tests for MPP challenge configuration, Payment Authorization parsing, Relayer authorization, and on-chain payment verification.

Run the project's configured test commands from the repository root. Check `package.json` for the current scripts.

### Solidity contract tests

Requires Foundry and Solidity 0.8.24.

```bash
cd contracts
forge test -vvv
```

The Solidity suite covers:

- Spender authorization and merchant allowlisting.
- Lifetime spending caps and per-transaction limits.
- Rate limits and window resets.
- Pause, unpause, and close behavior.
- Validity windows and expired mandates.
- Treasury deposits, withdrawals, and reserved-balance protection.
- Mandate top-ups and reservation accounting.
- Ownership transfer and delegated role behavior.
- Zero-address and invalid-parameter validation.
- Failed token transfer behavior.
- Reentrant token callback rejection.
- Duplicate challenge memo settlement prevention.

The test suite uses a mock TIP-20 token. Passing unit tests do not by themselves prove that the production RPC, deployed token, database, Relayer, and merchant endpoints have completed a real payment E2E.

## Deployment notes

The current V2 deployment is already deployed to Tempo Moderato.

The deployment command below is provided for reproducibility and future deployments. It is not a request to redeploy the existing contract.

```bash
cd contracts

forge script script/DeployModerato.s.sol:DeployMandateBookModerato \
  --rpc-url https://rpc.moderato.tempo.xyz \
  --tempo.fee-token 0x20c0000000000000000000000000000000000000 \
  --broadcast \
  --verify
```

Set `DEPLOYER_PRIVATE_KEY` in the process environment before broadcasting. Never commit private keys or `.env` files.

The deployer becomes the contract owner. Review the script, constructor arguments, role configuration, and deployment parameters before using it.

Do not run a deployment command merely to update documentation.

## Technology stack

- React 19
- TanStack Start
- Tailwind CSS 4
- Solidity 0.8.24
- Foundry
- Tempo TIP-20
- Machine Payments Protocol (MPP)
- viem

## Security notes

- Never commit private keys, seed phrases, API keys, or production environment files.
- Keep the Relayer credential server-side.
- Do not expose the Relayer private key to browser clients.
- Do not assume an HTTP 402 challenge represents a completed payment.
- Do not retry an unknown transaction outcome until the original transaction has been checked.
- Do not confuse the browser simulation with live contract state.
- Do not confuse Tempo Mainnet with Tempo Moderato testnet.

## License

[`contracts/src/MandateBook.sol`](contracts/src/MandateBook.sol) is licensed under Apache-2.0.
