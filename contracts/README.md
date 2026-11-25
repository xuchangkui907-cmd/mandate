
# MandateBook

**On-chain spending policies for AI agents on Tempo.**

MandateBook lets finance teams fund a shared TIP-20 treasury and issue spending mandates to authorized agents.

A mandate defines:

- The authorized spender.
- The token used for payments.
- The lifetime spending cap.
- The maximum amount per transaction.
- The rate limit and rate-limit window.
- The validity period.
- The merchant allowlist.
- Whether the mandate is paused or closed.

Agents do not receive treasury ownership or withdrawal authority. They can spend only within the permissions granted by their mandate.

An empty merchant allowlist is fail-closed: no merchant is authorized until explicitly allowlisted.

## Table of contents

- [Deployment status](#deployment-status)
- [Tempo networks](#tempo-networks)
- [Token configuration](#token-configuration)
- [V2 deployment addresses](#v2-deployment-addresses)
- [On-chain permission model](#on-chain-permission-model)
- [Mandate lifecycle](#mandate-lifecycle)
- [Mandate #1 deployed configuration](#mandate-1--deployed-configuration)
- [V2 initialization transactions](#v2-initialization-transactions)
- [Payment execution](#payment-execution)
- [Spending policy and failure conditions](#spending-policy-and-failure-conditions)
- [Treasury accounting](#treasury-accounting)
- [MPP integration](#mpp-integration)
- [Relayer API](#relayer-api)
- [Replay protection](#replay-protection)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Build and test](#build-and-test)
- [Deployment](#deployment)
- [Historical V1 deployment](#historical-v1-deployment)
- [Security considerations](#security-considerations)
- [License](#license)

## Deployment status

The current V2 contract is deployed on Tempo Moderato testnet.

| Property | Value |
|---|---|
| Contract | MandateBook V2 |
| Network | Tempo Moderato Testnet |
| Chain ID | `42431` |
| Contract address | `0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De` |
| Deployment block | `45829267` |
| Deployment transaction | [`0xd4f2041db4ddda2dcab234adb2e778726432665d7fb814c38ecab4b7d1b61a08`](https://explore.testnet.tempo.xyz/tx/0xd4f2041db4ddda2dcab234adb2e778726432665d7fb814c38ecab4b7d1b61a08) |
| Explorer | [MandateBook V2](https://explore.testnet.tempo.xyz/address/0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De) |

This is a testnet deployment. It is not a Tempo Mainnet deployment.

The production application is configured to use this V2 contract. Do not deploy a replacement contract merely to update documentation.

## Tempo networks

| Property | Tempo Mainnet | Tempo Moderato |
|---|---|---|
| Network type | Mainnet | Testnet |
| Chain ID | `4217` | `42431` |
| RPC | `https://rpc.tempo.xyz` | `https://rpc.moderato.tempo.xyz` |
| Explorer | [Mainnet Explorer](https://explore.tempo.xyz) | [Testnet Explorer](https://explore.testnet.tempo.xyz) |

The current V2 deployment uses Tempo Moderato, Chain ID `42431`.

Do not use the Mainnet RPC when interacting with this testnet deployment.

## Token configuration

The V2 deployment uses pathUSD.

| Property | Value |
|---|---|
| Token | pathUSD |
| Address | `0x20C0000000000000000000000000000000000000` |
| Decimals | 6 |

Other relevant Tempo system addresses:

| Name | Address |
|---|---|
| TIP-20 Factory | `0x20Fc000000000000000000000000000000000000` |
| Fee Manager | `0xfeec000000000000000000000000000000000000` |

Amounts are expressed in token base units.

```text
1 PATH_USD    = 1000000
0.40 PATH_USD =  400000
0.08 PATH_USD =   80000
```

The contract stores token amounts as integers. Applications must convert human-readable token amounts to base units using the token's decimals.

## V2 deployment addresses

| Role | Address |
|---|---|
| MandateBook V2 | `0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De` |
| Finance / Treasury wallet | `0x0253F2c64145eC9BB605Be8cbFc99B08E2E55438` |
| Authorized Relayer / Agent spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449e74` |
| pathUSD | `0x20C0000000000000000000000000000000000000` |

The Helios and Atlas merchant integrations currently share the same finance wallet address.

No private keys, seed phrases, or API credentials belong in this file or in source control.

## On-chain permission model

MandateBook separates contract ownership, treasury administration, policy administration, emergency control, and payment execution.

| Role | Permission |
|---|---|
| `owner` | Owns the contract and manages owner-controlled roles |
| `treasuryAdmin` | Deposits and withdraws treasury funds |
| `policyOperators` | Issues, tops up, configures, pauses/unpauses, and closes mandates |
| `emergencyGuardian` | Can pause mandates as an emergency action |
| Mandate `spender` | Calls `pay()` for a specific mandate, subject to its policy |

### Role boundaries

**Owner**

- Transfers contract ownership.
- Sets the treasury administrator.
- Sets the emergency guardian.
- Adds or removes policy operators.

**Treasury administrator**

- Deposits supported TIP-20 tokens.
- Withdraws only unencumbered treasury funds.
- Does not automatically gain permission to spend through every mandate unless separately configured as a spender.

**Policy operator**

- Issues mandates.
- Tops up mandates.
- Adds or removes merchant allowlist entries.
- Pauses and unpauses mandates.
- Closes mandates.

**Emergency guardian**

- Can pause a mandate.
- Cannot unpause a mandate unless also authorized as a policy operator.

**Mandate spender**

- Can call `pay()` only for the mandate where its address is configured as `spender`.
- Cannot withdraw treasury funds.
- Cannot modify the mandate's policy or merchant allowlist through spender authority alone.

The contract uses role modifiers to enforce these boundaries. The browser demo's simulated roles are not authoritative for the deployed contract.

### Ownership transfer behavior

Ownership transfer synchronizes default owner-managed permissions while preserving explicitly delegated roles.

When the owner is transferred:

- The new owner becomes the default treasury administrator if the treasury administrator was still the previous owner.
- The new owner becomes the default emergency guardian if the guardian was still the previous owner.
- The new owner receives policy-operator permission.
- The previous owner loses its default policy-operator permission.
- Explicitly delegated treasury administrator, guardian, and policy-operator assignments are preserved.

Review the current contract implementation before changing role assignments on a live deployment.

## Mandate lifecycle

A typical mandate lifecycle is:

```text
Treasury funded
      |
      v
Issue mandate
      |
      v
Configure merchant allowlist
      |
      v
Active mandate
      |
      +------> Pause ------> Unpause
      |
      +------> Pay -------> Remaining allowance decreases
      |
      +------> Top up ----> Spend cap and remaining increase
      |
      +------> Close ------> Unused reservation released
```

### Issue

A policy operator issues a mandate with:

- Spender.
- Token.
- Lifetime cap.
- Maximum per-transaction amount.
- Validity start and end.
- Rate limit.
- Rate-limit window.
- Department identifier.

The contract reserves the mandate's initial spending cap against the treasury's unencumbered balance.

### Configure merchants

A policy operator explicitly enables merchant addresses with `setMerchant()`.

An empty allowlist does not authorize arbitrary merchants.

### Top up

A policy operator can increase an open mandate's `spendMax` and `remaining` using `topUp()`.

The additional amount must be available in the unencumbered treasury balance.

### Pause and unpause

A guardian or policy operator can pause an open mandate.

Only a policy operator can unpause it.

### Close

A policy operator can close an open mandate. Closing sets its remaining allowance to zero and releases the unused reservation.

Closing a mandate does not automatically transfer treasury tokens to another address. Released funds become unencumbered treasury funds.

## Mandate #1 — deployed configuration

The V2 contract has Mandate #1 configured with the following policy.

| Parameter | Value |
|---|---:|
| Mandate ID | `1` |
| Spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449e74` |
| Token | pathUSD |
| Lifetime cap (`spendMax`) | 100 PATH_USD |
| Remaining allowance | 100 PATH_USD |
| Maximum per transaction (`maxPerTx`) | 1 PATH_USD |
| Rate limit (`rateLimit`) | 5 PATH_USD |
| Rate window (`window`) | 3600 seconds |
| Merchant allowlist count | 1 |
| Paused | `false` |
| Closed | `false` |
| Department hash | `0xb77bf3b810235a918879a4b239ef948ceff141ffc95e62ec01430ae43fd45f07` |

The initial V2 treasury funding was 200 PATH_USD.

At the time of the read-only production verification:

| Treasury state | Amount |
|---|---:|
| Total funded | 200 PATH_USD |
| Reserved by Mandate #1 | 100 PATH_USD |
| Unencumbered balance | 100 PATH_USD |
| Mandate #1 remaining | 100 PATH_USD |
| Mandate #1 window spent | 0 PATH_USD |

The contract reported:

```text
allowlistCount = 1
paused         = false
closed         = false
window         = 3600
```

The allowlist contains one unique merchant wallet because Helios and Atlas currently use the same finance wallet address.

These values represent the state at the time of verification. They can change after on-chain operations.

## V2 initialization transactions

The following transactions initialized the V2 deployment.

| Step | Operation | Transaction | Block |
|---|---|---|---:|
| 1 | Deploy MandateBook V2 | [`0xd4f2041db4ddda2dcab234adb2e778726432665d7fb814c38ecab4b7d1b61a08`](https://explore.testnet.tempo.xyz/tx/0xd4f2041db4ddda2dcab234adb2e778726432665d7fb814c38ecab4b7d1b61a08) | 45829267 |
| 2 | Approve token spending | [`0x1ffb834053073b6a0541b86d565943b9be5e3bb8315dffbef09ea02445f2d20a`](https://explore.testnet.tempo.xyz/tx/0x1ffb834053073b6a0541b86d565943b9be5e3bb8315dffbef09ea02445f2d20a) | 45829271 |
| 3 | Deposit 200 PATH_USD | [`0xdae644a1db992ace74b6daf2509f25a3ce0222073aa0d5c98dff448d95fdfb79`](https://explore.testnet.tempo.xyz/tx/0xdae644a1db992ace74b6daf2509f25a3ce0222073aa0d5c98dff448d95fdfb79) | 45829275 |
| 4 | Create Mandate #1 | [`0x414eeed8a96bf4f58efcc1163eca6a88e88e7d17f23727f8b65092df2c8add82`](https://explore.testnet.tempo.xyz/tx/0x414eeed8a96bf4f58efcc1163eca6a88e88e7d17f23727f8b65092df2c8add82) | 45829278 |
| 5 | Add Helios merchant | [`0x06299f0ae672930cd85feb5bcab6bd2fb290da2662acfb16e5e52ebd982c91c3`](https://explore.testnet.tempo.xyz/tx/0x06299f0ae672930cd85feb5bcab6bd2fb290da2662acfb16e5e52ebd982c91c3) | 45829281 |
| 6 | Add Atlas merchant | [`0x6b9bd6ea35c02b3870ac4ccbb2ddb4e7f062899b585efb3f5d07a8da3f236b6`](https://explore.testnet.tempo.xyz/tx/0x6b9bd6ea35c02b3870ac4ccbb2ddb4e7f062899b585efb3f5d07a8da3f236b6) | 45829284 |

The two merchant configuration transactions refer to the same unique wallet address in the current configuration. The resulting allowlist count is therefore one.

## Payment execution

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

## Spending policy and failure conditions

### Payment errors

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

### Authorization errors

| Condition | Revert |
|---|---|
| Caller is not the contract owner | `NotOwner` |
| Caller is not the treasury administrator | `NotTreasuryAdmin` |
| Caller is not a policy operator | `NotPolicyOperator` |
| Caller is neither guardian nor policy operator | `NotGuardianOrOperator` |

### Input and accounting errors

| Condition | Revert |
|---|---|
| Zero address supplied | `ZeroAddress` |
| Invalid spending cap | `InvalidSpendMax` |
| Invalid validity range | `InvalidValidityRange` |
| Nonzero rate limit with zero-length window | `InvalidWindow` |
| Withdrawal exceeds unencumbered treasury balance | `ExceedsUnencumberedBalance` |

The Solidity source is authoritative for the complete error definitions and exact revert behavior.

## Treasury accounting

MandateBook uses a shared TIP-20 treasury with reservation accounting.

The important accounting values are:

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

The contract checks the actual token balance before payment. A token balance deficit cannot be hidden by the internal reservation accounting.

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

## MPP integration

The Machine Payments Protocol (MPP) integration connects HTTP 402 challenges to on-chain mandate payments.

The production resource endpoints include:

| Resource | Endpoint | Price |
|---|---|---:|
| Helios | `/api/mpp/helios` | 0.40 PATH_USD |
| Atlas | `/api/mpp/atlas` | 0.08 PATH_USD |

The resource route is:

```text
GET /api/mpp/$resource
```

### Challenge creation

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

### Payment submission

The client or Relayer submits the on-chain payment using the challenge values:

```solidity
pay(mandateId, merchant, amount, memo)
```

The Relayer path additionally validates that the challenge matches the server's configured resource, merchant, amount, mandate, contract, chain, token, and spender.

### Payment verification

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

### Database protections

The MPP store persists challenge records, redeemed transactions, payment receipts, and rate-limit state.

The redemption flow uses a database transaction and unique conflict handling to prevent concurrent reuse of a transaction hash or challenge ID.

The server's database redemption check complements, but does not replace, the on-chain `settledMemos` protection.

## Relayer API

The protected endpoint is:

```text
/api/relayer/action
```

Both GET and POST require the configured Bearer authorization credential.

### GET — read-only live state

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

### POST — pay a challenge

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

Possible response outcomes include:

| HTTP status / outcome | Meaning |
|---|---|
| `200` / `confirmed` | Payment succeeded and the expected event and memo state were verified |
| `400` / `reverted` | Validation or contract policy prevented payment |
| `404` | Challenge not found |
| `409` | Challenge payment already in progress or already settled |
| `202` / `unknown` | Transaction was broadcast but confirmation or verification is unavailable |
| `429` | Rate limit exceeded |
| `503` | Relayer could not complete or determine the operation |

A `202` / `unknown` result must be investigated using the transaction hash and on-chain state before another payment attempt.

POST submits a real testnet transaction when successfully invoked. It is not a read-only endpoint.

## Replay protection

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

## Project structure

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

## Build and test

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

The following command documents the deployment process for a future deployment. It is not an instruction to redeploy the existing production contract.

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

## Security considerations

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

## Verification status

The following have been verified in the deployed environment:

- V2 contract deployment and address.
- Mandate #1 configuration.
- Treasury reservation and unencumbered balance through read-only contract queries.
- Helios and Atlas HTTP 402 challenge responses.
- Protected Relayer GET response with live V2 state.

A complete production payment E2E has not yet been confirmed. That requires a real challenge, a successful on-chain payment, a matching `Paid` event, a successful `settledMemos` check, successful server-side redemption, and an HTTP 200 paid-resource response.

## License

[`MandateBook.sol`](src/MandateBook.sol) is licensed under Apache-2.0.
