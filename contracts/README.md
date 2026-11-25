# MandateBook V2 — Tempo Smart Contract

MandateBook is an on-chain spending-policy contract for AI agents and automated payment systems.

It allows finance teams to fund a shared TIP-20 treasury, issue scoped spending mandates, authorize specific spenders and merchants, and enforce spending limits directly on Tempo.

The contract is part of the Mandate project, built for the [Crypto World's Fair](https://colosseum.com/worldsfair) Tempo track.

## Project Status

| Component | Status |
|---|---|
| MandateBook V2 | Deployed on Tempo Moderato testnet |
| Chain ID | `42431` |
| Solidity compiler | `0.8.24` |
| TIP-20 integration | Implemented |
| Treasury reservation accounting | Implemented |
| Spender authorization | Implemented |
| Merchant allowlisting | Implemented |
| Lifetime spending caps | Implemented |
| Per-transaction limits | Implemented |
| Rate limits | Implemented |
| Pause and close controls | Implemented |
| MPP challenge memo binding | Implemented |
| On-chain duplicate memo protection | Implemented |
| Helios payment E2E | Verified on 2026-11-25 |

The contract is deployed to Tempo Moderato testnet, not Tempo Mainnet.

## Deployed Network

### Tempo Moderato Testnet

| Property | Value |
|---|---|
| Network | Tempo Moderato Testnet |
| Chain ID | `42431` |
| RPC | `https://rpc.moderato.tempo.xyz` |
| Explorer | [Tempo Testnet Explorer](https://explore.testnet.tempo.xyz) |
| Native fee token | pathUSD |
| pathUSD decimals | 6 |
| pathUSD address | `0x20C0000000000000000000000000000000000000` |

Tempo Mainnet is a separate network:

| Property | Value |
|---|---|
| Network | Tempo Mainnet |
| Chain ID | `4217` |
| RPC | `https://rpc.tempo.xyz` |
| Explorer | [Tempo Mainnet Explorer](https://explore.tempo.xyz) |

**Do not use Tempo Mainnet RPC when interacting with the current Moderato deployment.**

## MandateBook V2 Deployment

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

## Operational Addresses

| Role | Address |
|---|---|
| Finance / Treasury wallet | `0x0253F2c64145E9CBB605Be8cbFc99B08E2E55438` |
| Authorized Relayer / Agent spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449E74` |

The Helios and Atlas merchant integrations currently share the same finance wallet address. They therefore represent one unique merchant allowlist entry in Mandate #1.

## Architecture

```text
Finance
  |
  | Deposit pathUSD
  v
MandateBook V2
  |
  | Reserve treasury funds
  | Issue scoped mandate
  | Configure spender and merchants
  v
Authorized Agent / Relayer
  |
  | pay(mandateId, merchant, amount, memo)
  v
MandateBook V2
  |
  | Enforce spending policy
  | Validate memo
  | Update accounting
  v
TIP-20 transferWithMemo
  |
  v
Merchant Wallet
```

The contract is the authoritative enforcement layer for spending policy.

The MPP server creates HTTP payment challenges and verifies that the corresponding on-chain payment was successfully settled before delivering paid resources.

## Core Design Principles

1. Finance controls the treasury.
2. Agents receive scoped spending authority, not treasury ownership.
3. Each mandate has an authorized spender.
4. Merchant permissions are explicitly allowlisted.
5. Lifetime spending caps are enforced on-chain.
6. Per-transaction limits are enforced on-chain.
7. Rate limits are enforced on-chain.
8. Paused or closed mandates cannot spend.
9. Challenge memos cannot be settled twice for the same mandate.
10. Treasury withdrawals cannot consume funds reserved for mandates.

## Mandate #1 — Deployed Configuration

Mandate #1 is configured on the V2 contract.

| Parameter | Configured value |
|---|---:|
| Mandate ID | `1` |
| Spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449E74` |
| Token | pathUSD |
| Initial lifetime cap (`spendMax`) | 100 PATH_USD |
| Initial maximum per transaction (`maxPerTx`) | 1 PATH_USD |
| Rate limit (`rateLimit`) | 5 PATH_USD |
| Rate window (`window`) | 3600 seconds |
| Merchant allowlist count | 1 |
| Paused | `false` at the recorded configuration check |
| Closed | `false` at the recorded configuration check |
| Department hash | `0xb77bf3b810235a918879a4b239ef948ceff141ffc95e62ec01430ae43fd45f07` |

The initial V2 treasury funding was 200 PATH_USD.

At the time of the original read-only verification:

| Treasury state | Amount |
|---|---:|
| Total funded | 200 PATH_USD |
| Reserved by Mandate #1 | 100 PATH_USD |
| Unencumbered balance | 100 PATH_USD |
| Mandate #1 remaining | 100 PATH_USD |
| Mandate #1 window spent | 0 PATH_USD |

The Helios and Atlas integrations use the same merchant wallet address, so the allowlist contains one unique merchant.

These values are historical configuration and verification data. They must not be treated as current live balances or allowances after subsequent payments.

## V2 Initialization Transactions

The following transactions initialized the V2 deployment.

| Step | Operation | Transaction | Block |
|---|---|---|---:|
| 1 | Deploy MandateBook V2 | [`0xd4f2041db4ddda2dcab234adb2e778726432665d7fb814c38ecab4b7d1b61a08`](https://explore.testnet.tempo.xyz/tx/0xd4f2041db4ddda2dcab234adb2e778726432665d7fb814c38ecab4b7d1b61a08) | 45829267 |
| 2 | Approve token spending | [`0x1ffb834053073b6a0541b86d565943b9be5e3bb8315dffbef09ea02445f2d20a`](https://explore.testnet.tempo.xyz/tx/0x1ffb834053073b6a0541b86d565943b9be5e3bb8315dffbef09ea02445f2d20a) | 45829271 |
| 3 | Deposit 200 PATH_USD | [`0xdae644a1db992ace74b6daf2509f25a3ce0222073aa0d5c98dff448d95fdfb79`](https://explore.testnet.tempo.xyz/tx/0xdae644a1db992ace74b6daf2509f25a3ce0222073aa0d5c98dff448d95fdfb79) | 45829275 |
| 4 | Create Mandate #1 | [`0x414eeed8a96bf4f58efcc1163eca6a88e88e7d17f23727f8b65092df2c8add82`](https://explore.testnet.tempo.xyz/tx/0x414eeed8a96bf4f58efcc1163eca6a88e88e7d17f23727f8b65092df2c8add82) | 45829278 |
| 5 | Add Helios merchant | [`0x06299f0ae672930cd85feb5bcab6bd2fb290da2662acfb16e5e52ebd982c91c3`](https://explore.testnet.tempo.xyz/tx/0x06299f0ae672930cd85feb5bcab6bd2fb290da2662acfb16e5e52ebd982c91c3) | 45829281 |
| 6 | Add Atlas merchant | [`0x6b9bd6ea35c02b3870ac4ccbb2ddb4e7f062899b585efb3f5d07a8da3f236b6`](https://explore.testnet.tempo.xyz/tx/0x6b9bd6ea35c02b3870ac4ccbb2ddb4e7f062899b585efb3f5d07a8da3f236b6) | 45829284 |

The two merchant configuration transactions refer to the same unique wallet address in the current configuration.

## Contract Interface and Roles

MandateBook separates the following roles:

| Role | Responsibility |
|---|---|
| `owner` | Owns the contract and manages owner-controlled roles |
| `treasuryAdmin` | Deposits and withdraws treasury funds |
| `policyOperators` | Issues, tops up, configures, pauses/unpauses, and closes mandates |
| `emergencyGuardian` | Can pause mandates as an emergency action |
| Mandate `spender` | Executes payments within the mandate's limits |

Important permission boundaries:

- A spender cannot withdraw treasury funds.
- A spender cannot change merchant permissions or mandate limits.
- A policy operator cannot spend unless also authorized as the mandate spender.
- An emergency guardian can pause but cannot unpause unless it also has policy-operator permission.
- Delegated role permissions are separate from mandate spending authority.

The deployed contract's role assignments should be verified on-chain. The browser demonstration's simulated roles are not evidence of live role assignments.

## Payment Execution

The core payment function is:

```solidity
pay(
    uint256 id,
    address merchant,
    uint128 amount,
    bytes32 memo
)
```

The function is callable only by the spender configured in the selected mandate.

The payment flow is:

1. Load and validate the mandate.
2. Reject a closed or paused mandate.
3. Check the validity period.
4. Check the caller against the authorized spender.
5. Reject a zero payment amount.
6. Enforce the per-transaction limit.
7. Check the merchant allowlist.
8. Reject an already settled challenge memo.
9. Check remaining lifetime allowance.
10. Enforce the rate limit.
11. Verify actual token balance against reserved treasury obligations and the payment amount.
12. Mark the memo as settled and update accounting.
13. Transfer tokens to the merchant with the memo.
14. Emit the `Paid` event.

The token transfer uses TIP-20 `transferWithMemo`:

```solidity
ITIP20(m.token).transferWithMemo(
    merchant,
    uint256(amount),
    memo
);
```

The 32-byte memo binds the payment to the MPP challenge.

The contract uses a reentrancy guard for the payment path.

## Spending Policy and Failure Conditions

### Payment Errors

| Condition | Revert |
|---|---|
| Mandate ID does not exist | `UnknownMandate` |
| Caller is not the authorized spender | `NotSpender` |
| Mandate is paused | `MandatePaused` |
| Mandate is closed | `MandateClosed` |
| Mandate is not yet valid | `MandateNotYetValid` |
| Mandate has expired | `MandateExpired` |
| Merchant is not allowlisted | `MerchantNotAllowed` |
| Payment amount is zero | `ZeroAmount` |
| Payment exceeds `maxPerTx` | `PerTxLimitExceeded` |
| Challenge memo already settled for this mandate | `ChallengeAlreadySettled` |
| Remaining lifetime allowance is insufficient | `CapExceeded` |
| Rate limit would be exceeded | `RateLimited` |
| Actual treasury balance cannot cover reserved obligations and payment | `InsufficientTreasury` |

### Authorization Errors

| Condition | Revert |
|---|---|
| Caller is not the contract owner | `NotOwner` |
| Caller is not the treasury administrator | `NotTreasuryAdmin` |
| Caller is not a policy operator | `NotPolicyOperator` |
| Caller is neither guardian nor policy operator | `NotGuardianOrOperator` |

### Input and Accounting Errors

| Condition | Revert |
|---|---|
| Zero address supplied | `ZeroAddress` |
| Invalid spending cap | `InvalidSpendMax` |
| Invalid validity range | `InvalidValidityRange` |
| Nonzero rate limit with zero-length window | `InvalidWindow` |
| Withdrawal exceeds unencumbered treasury balance | `ExceedsUnencumberedBalance` |

The Solidity source is authoritative for complete error definitions and exact revert behavior.

## Treasury Accounting

MandateBook uses a shared TIP-20 treasury with reservation accounting.

Important accounting values:

- Token balance held by the contract.
- `reservedByToken[token]`: total amount reserved by open mandates.
- `unencumberedBalance(token)`: balance available for new reservations or treasury withdrawal.
- Mandate `spendMax`: lifetime policy cap.
- Mandate `remaining`: unused lifetime policy allowance.

Conceptually:

```text
unencumberedBalance
    = actual token balance
    - total reserved amount
```

The contract checks the actual token balance before payment. A token balance deficit cannot be hidden by internal reservation accounting.

### Issue

Issuing a mandate reserves its initial `spendMax` amount.

The amount must be available as unencumbered treasury funds.

### Payment

A successful payment:

- Reduces `remaining`.
- Reduces `reservedByToken[token]`.
- Increases `windowSpent` when rate limiting is enabled.
- Transfers the payment to the merchant.

### Top-up

A successful top-up:

- Increases `spendMax`.
- Increases `remaining`.
- Increases `reservedByToken[token]`.

The added amount must be available as unencumbered funds.

### Close

Closing a mandate:

- Sets `closed = true`.
- Sets `remaining = 0`.
- Releases the unused reservation.
- Does not withdraw tokens from the contract.

### Withdraw

The treasury administrator can withdraw only unencumbered funds.

Reserved mandate funds cannot be withdrawn.

## MPP Integration

The Machine Payments Protocol (MPP) integration connects HTTP 402 challenges to on-chain mandate payments.

Production resource endpoints:

| Resource | Endpoint | Price |
|---|---|---:|
| Helios | `/api/mpp/helios` | 0.40 PATH_USD |
| Atlas | `/api/mpp/atlas` | 0.08 PATH_USD |

The resource route is:

```text
GET /api/mpp/$resource
```

### Challenge Creation

A client requests a resource without a Payment Authorization header.

The server:

1. Checks the resource key.
2. Applies a shared rate limit.
3. Loads the configured contract, merchant, spender, token, and mandate.
4. Creates a unique challenge ID.
5. Derives a 32-byte memo from the challenge ID.
6. Persists the challenge with its expected payment configuration and expiry.
7. Returns HTTP `402 Payment Required`.

The response includes a `WWW-Authenticate` payment challenge containing the Tempo chain ID, contract, mandate ID, spender, token, merchant, amount, challenge ID, and memo.

A challenge expires after five minutes.

### Payment Submission

The client or Relayer submits the on-chain payment using the challenge values:

```solidity
pay(mandateId, merchant, amount, memo)
```

The Relayer path additionally validates that the challenge matches the server's configured resource, merchant, amount, mandate, contract, chain, token, and spender.

### Payment Verification

The client retries the original resource endpoint with a Tempo Payment Authorization header containing the transaction hash and challenge ID.

The verifier checks:

1. Challenge chain ID.
2. MandateBook contract binding.
3. Challenge memo derivation.
4. Challenge expiry.
5. Whether the transaction hash or challenge ID has already been redeemed.
6. RPC chain ID.
7. Transaction receipt status.
8. A `Paid` event emitted by the configured MandateBook contract.
9. Exact mandate ID, spender, merchant, token, amount, and memo.
10. On-chain `settledMemos` state.
11. Atomic database redemption and payment receipt persistence.

Only a verified payment returns HTTP 200 with the protected resource and a `Payment-Receipt` response header.

### Database Protections

The MPP store persists challenge records, redeemed transactions, payment receipts, and rate-limit state.

The redemption flow uses a database transaction and unique conflict handling to prevent concurrent reuse of a transaction hash or challenge ID.

The server's database redemption check complements, but does not replace, the on-chain `settledMemos` protection.

## Verified Helios Payment E2E — 2026-11-25

A real Helios MPP payment was successfully completed on Tempo Moderato testnet.

### Challenge and Payment Details

| Evidence | Result |
|---|---|
| Resource | Helios Research API |
| Challenge ID | `mpp_helios_be298a956bb84b3784daf568be912ce6` |
| Challenge memo | `0x39ea9180b9768bb8bee9f0702225044e12ec162930436a499289da5da27843cc` |
| Chain ID | `42431` |
| Mandate ID | `1` |
| Payment | `0.40 PATH_USD` |
| Base units | `400000` |
| Relayer response | HTTP `200` |
| Outcome | `confirmed` |
| Reverted | `false` |
| Transaction hash | `0x67806d9bdfc2ebab0d3458c72202d411e94544428b4adb82852159db13ffe4a6` |
| Block | `45864838` |
| Gas used | `333934` |
| Merchant response | HTTP `200` |
| Payment-Receipt | Returned successfully |
| Settlement | `ok: true` |

[View successful payment on Tempo Explorer](https://explore.testnet.tempo.xyz/tx/0x67806d9bdfc2ebab0d3458c72202d411e94544428b4adb82852159db13ffe4a6)

### Delivered Resource

The merchant returned:

```json
{
  "signal": "SOL/USDC orderbook imbalance +2.4 sigma",
  "confidence": 0.91,
  "source": "Helios Live Feed"
}
```

The `Payment-Receipt` header included the payment method, chain ID, transaction hash, block number, and challenge ID.

The successful merchant response demonstrates the complete tested sequence:

```text
MPP Challenge
     |
     v
Relayer Payment Submission
     |
     v
Tempo On-chain Confirmation
     |
     v
MandateBook Paid Event
     |
     v
settledMemos Verification
     |
     v
Merchant Challenge Verification
     |
     v
HTTP 200 + Payment-Receipt
     |
     v
Protected Resource Delivered
```

An earlier test payment on the same date was also confirmed on-chain, but its merchant verification request arrived after the five-minute challenge expiry. That earlier transaction did not deliver the resource and is not counted as a successful E2E.

This result proves one successful Helios testnet E2E, not Mainnet deployment or production-scale reliability.

## Relayer API

The protected endpoint is:

```text
/api/relayer/action
```

Both GET and POST require the configured Bearer authorization credential.

POST requests are rate-limited. Responses use no-store cache headers.

### GET — Read-only Live State

GET reads the configured Moderato RPC and returns:

- Chain ID and contract address.
- Current block number.
- Unencumbered treasury balance.
- Reserved amount by token.
- Merchant allowlist count.
- Mandate spender and token.
- Spending cap and remaining allowance.
- Per-transaction limit.
- Validity timestamps.
- Rate limit and window accounting.
- Paused and closed status.
- Department hash.

GET does not submit a transaction.

### POST — Pay a Challenge

POST accepts:

```json
{
  "action": "pay_challenge",
  "challengeId": "mpp_helios_REPLACE_WITH_REAL_CHALLENGE_ID"
}
```

The challenge ID must be real, valid, stored, and unexpired. The example is illustrative only.

Before submission, the Relayer checks:

- Challenge existence and expiry.
- Configured demo mandate ID.
- Tempo Moderato chain ID.
- Configured MandateBook contract.
- Moderato pathUSD token.
- Expected spender against the configured Relayer account.
- Supported resource key.
- Configured merchant address.
- Exact resource price.
- On-chain challenge memo settlement state.

The Relayer simulates `pay()`, submits the transaction, waits for its receipt, verifies the `Paid` event, and checks `settledMemos`.

### POST Response Codes

| HTTP status | Outcome / condition | Meaning |
|---|---|---|
| `200` | `confirmed` | Payment succeeded and the expected event and memo state were verified |
| `400` | Invalid request / validation error | Invalid JSON body, unsupported action, invalid challenge ID, expired challenge, chain/contract/token/resource/merchant/amount mismatch, or a policy revert detected before broadcast |
| `401` | Unauthorized | Missing or invalid Bearer authorization credential |
| `403` | Forbidden | Challenge mandate ID or expected spender does not match the configured Relayer |
| `404` | Challenge not found | The challenge ID does not exist in challenge storage |
| `409` | Conflict | Challenge payment is already in progress or its memo is already settled on-chain |
| `429` | Rate limited | The Relayer POST request exceeded the configured shared rate limit |
| `502` | `reverted` | A broadcast transaction was mined with a reverted receipt |
| `502` | `verification_failed` | The transaction succeeded, but the expected event or memo state could not be verified |
| `202` | `unknown` | Transaction was broadcast but confirmation or verification is unavailable |
| `503` | Service unavailable / unknown | Relayer configuration is unavailable or submission outcome cannot be determined |

Important transaction handling:

- A `202` response means the transaction was broadcast. It does not mean the transaction failed.
- A `502 / reverted` response means a transaction was mined and reverted.
- A `502 / verification_failed` response means the transaction succeeded, but the application could not verify the expected event or memo state.
- A `503` response can represent an uncertain submission outcome.
- Do not retry an uncertain payment until the original transaction and on-chain state have been checked.
- A `400` policy revert detected before broadcast does not represent a successful payment.

POST submits a real testnet transaction when successfully invoked. It is not a read-only endpoint.

## Replay Protection

MandateBook maintains:

```solidity
settledMemos[mandateId][memo]
```

A memo can be settled only once for a given mandate.

A duplicate payment using the same mandate and memo reverts with:

```solidity
ChallengeAlreadySettled
```

The server adds independent replay protections:

- Reject a transaction hash already redeemed.
- Reject a challenge ID already redeemed.
- Persist redemption atomically.
- Prevent concurrent processing of the same challenge inside a running Relayer process.

The on-chain mapping is the durable contract-level protection. The database and in-process guard protect the HTTP and Relayer workflows.

## Project Structure

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
```

The application, MPP integration, and Relayer API live in the repository's `src/` directory.

Relevant application modules include:

```text
src/
  lib/
    mpp/
      challenge-config.ts
      payment-auth.ts
      relayer-auth.ts
      store.ts
      verifier.ts
    tempo/
      constants.ts
  routes/
    api/
      mpp/
        $resource.ts
      relayer/
        action.ts
```

The SDK contains the contract ABI and Tempo client configuration used by the application.

## Requirements

- Foundry
- Solidity `0.8.24`
- Tempo Moderato RPC access
- Moderato pathUSD for testnet transactions
- Node.js 20 or newer for the application and API
- A funded testnet deployer for a new deployment
- A configured Relayer account for Relayer payment execution

## Build and Test

Run the Solidity tests from the `contracts` directory:

```bash
cd contracts
forge test -vvv
```

Build the contract:

```bash
forge build
```

Run a focused test:

```bash
forge test --match-contract MandateBookTest -vvv
```

The Foundry test suite uses a mock TIP-20 token. It covers policy enforcement and contract failure paths, including:

- Spender authorization.
- Merchant allowlisting.
- Lifetime spending caps.
- Per-transaction limits.
- Rate limits and window resets.
- Pausing and unpausing.
- Closing mandates.
- Validity windows.
- Treasury deposits and withdrawals.
- Reserved-balance protection.
- Mandate top-ups.
- Ownership transfer and delegated role behavior.
- Zero-address and invalid-parameter validation.
- Token transfer failure handling.
- Reentrant token callback rejection.
- Duplicate challenge memo settlement prevention.

Passing unit tests does not prove that a production RPC, deployed token, database, Relayer, and merchant endpoint have completed a real payment E2E.

## Deployment

The current V2 contract is already deployed to Tempo Moderato.

The following command documents the deployment process for a future deployment. It is not an instruction to redeploy the existing contract.

```bash
cd contracts

forge script script/DeployModerato.s.sol:DeployMandateBookModerato \
  --rpc-url https://rpc.moderato.tempo.xyz \
  --tempo.fee-token 0x20c0000000000000000000000000000000000000 \
  --broadcast \
  --verify
```

Set `DEPLOYER_PRIVATE_KEY` in the process environment before broadcasting.

Never commit:

- Private keys.
- Seed phrases.
- `.env` files.
- API credentials.
- Production secrets.

The deployer becomes the contract owner. Review the deployment script, constructor arguments, role assignments, and network parameters before broadcasting.

Do not use the Mainnet RPC for the current Moderato deployment.

Do not redeploy merely to update documentation.

## Historical V1 Deployment

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

## Verification Status

The following have been verified in the deployed environment:

- V2 contract deployment and address.
- Mandate #1 configuration.
- Historical treasury reservation and unencumbered balance through read-only contract queries.
- Helios and Atlas HTTP 402 challenge responses.
- Protected Relayer GET response with live V2 state.
- A real Helios MPP payment transaction confirmed on Tempo Moderato.
- Successful merchant-side verification of the matching challenge and on-chain payment.
- Successful HTTP 200 paid-resource response.
- A `Payment-Receipt` response header containing the confirmed transaction details.

### Verified Helios Payment — 2026-11-25

| Evidence | Result |
|---|---|
| Resource | Helios Research API |
| Challenge ID | `mpp_helios_be298a956bb84b3784daf568be912ce6` |
| Challenge memo | `0x39ea9180b9768bb8bee9f0702225044e12ec162930436a499289da5da27843cc` |
| Chain ID | `42431` |
| Mandate ID | `1` |
| Payment | `0.40 PATH_USD` (`400000` base units) |
| Relayer response | HTTP `200`, `outcome=confirmed`, `reverted=false` |
| Transaction | [View on Tempo Explorer](https://explore.testnet.tempo.xyz/tx/0x67806d9bdfc2ebab0d3458c72202d411e94544428b4adb82852159db13ffe4a6) |
| Block | `45864838` |
| Gas used | `333934` |
| Merchant response | HTTP `200` |
| Payment-Receipt | Successfully returned |
| Resource | `Helios Research API` |
| Signal | `SOL/USDC orderbook imbalance +2.4 sigma` |
| Confidence | `0.91` |
| Settlement | `ok: true` |

The merchant accepted the Payment Authorization for the matching challenge, verified the on-chain settlement, and returned the protected resource with a `Payment-Receipt` header.

This confirms one complete real payment E2E on Tempo Moderato testnet. It does not establish Tempo Mainnet deployment, production-scale reliability, or successful E2E for every merchant/resource.

An earlier test transaction on the same date was confirmed on-chain, but its subsequent merchant verification request arrived after the five-minute challenge expiry. That transaction did not deliver the resource and is not counted as a successful E2E.

## License

[`MandateBook.sol`](src/MandateBook.sol) is licensed under Apache-2.0.
