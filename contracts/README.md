
# MandateBook

**On-chain spending policies for AI agents on Tempo.**

MandateBook lets finance teams fund a shared TIP-20 treasury and issue spending mandates to authorized agents.

A mandate defines:

- Who is allowed to spend
- Which merchants can receive payments
- The lifetime spending cap
- The maximum amount per transaction
- The rate limit and rate-limit window
- The validity period
- Whether the mandate is paused or closed

Agents do not receive treasury ownership or withdrawal authority. They can spend only within the permissions granted by their mandate.

An empty merchant allowlist is fail-closed.

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

## V2 deployment addresses

| Role | Address |
|---|---|
| MandateBook V2 | `0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De` |
| Finance / Treasury wallet | `0x0253F2c64145eC9BB605Be8cbFc99B08E2E55438` |
| Authorized Relayer / Agent spender | `0x62b091fA422e3F6fF9420aB76c2253d04C449e74` |
| pathUSD | `0x20C0000000000000000000000000000000000000` |

The Helios and Atlas merchant integrations currently share the same finance wallet address.

No private keys, seed phrases, or API credentials belong in this file or in source control.

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

## How MandateBook maps to MPP

The Machine Payments Protocol (MPP) payment flow is:

1. An agent requests a paid resource from a merchant.
2. The merchant responds with HTTP `402 Payment Required` and a payment challenge.
3. The agent processes the payment challenge.
4. The payment is authorized against the relevant mandate.
5. The payment is submitted on Tempo.
6. The merchant verifies the payment and returns the resource.

The on-chain payment operation is:

```solidity
pay(id, merchant, amount, memo)
```

The `memo` is the 32-byte MPP challenge ID.

Settlement uses TIP-20 `transferWithMemo`. This links the payment transaction to the original HTTP payment challenge.

The mandate checks the spender, validity window, lifetime cap, merchant allowlist, rate limit, and available treasury before allowing a payment.

The agent key cannot withdraw treasury funds.

## Spending policy and failure conditions

| Condition | Revert |
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
| Treasury cannot cover the payment | `InsufficientTreasury` |

An empty merchant allowlist is fail-closed.

`remaining` is a policy cap against a shared TIP-20 treasury. It is not an independent escrow balance.

Closing a mandate does not automatically return funds to the finance wallet. Finance must explicitly withdraw unused treasury funds.

## Production API integration

The server-side application exposes MPP endpoints for the two merchant integrations:

| Merchant | Endpoint | Challenge amount |
|---|---|---:|
| Helios | `/api/mpp/helios` | 0.40 PATH_USD |
| Atlas | `/api/mpp/atlas` | 0.08 PATH_USD |

A GET request returns an HTTP 402 payment challenge.

Example:

```bash
curl -i https://YOUR_HOST/api/mpp/helios
curl -i https://YOUR_HOST/api/mpp/atlas
```

The challenge is configured for:

```text
Chain ID:      42431
Mandate ID:    1
Contract:      0x3F0AA3335d9CE2E6dc7e51d32880471f0d08B9De
Spender:       0x62b091fA422e3F6fF9420aB76c2253d04C449e74
Helios amount: 400000
Atlas amount:   80000
```

The Relayer read endpoint is:

```text
GET /api/relayer/action
```

It is protected by server-side Bearer authorization and reads the deployed V2 contract state.

The server also implements payment challenge handling and settled-memo duplicate protection.

### Verification status

The following production checks have been completed:

- V2 contract deployment confirmed.
- V2 contract address and chain ID verified.
- Mandate #1 state read from the deployed contract.
- Treasury reserved and unencumbered balances read from the deployed contract.
- Helios MPP endpoint returned the expected HTTP 402 challenge.
- Atlas MPP endpoint returned the expected HTTP 402 challenge.
- Protected Relayer read endpoint returned the expected live V2 state.

**A complete real payment end-to-end test has not yet been confirmed.**

In particular, a successful HTTP 402 response or a successful read-only contract query does not by itself prove that a payment has been submitted, settled on-chain, and followed by a successful merchant resource response.

## V1 historical deployment

The original V1 contract is preserved as a historical deployment.

| Property | Value |
|---|---|
| Contract | MandateBook V1 |
| Network | Tempo Moderato Testnet |
| Chain ID | `42431` |
| Historical contract address | `0xbe8731569E5A5460C1a27bd5DAA280157b3eD353` |
| Historical owner | `0xc97d95982AD8E3DaC45b3A14402745096E2dA206` |

V1 is not the active V2 contract.

The V1 contract, owner, historical state, and existing funds have been preserved. V1 balances and mandate data have not been migrated to V2.

Do not overwrite, withdraw, or otherwise alter V1 state as part of V2 maintenance unless a separate, explicit migration plan is approved.

## Development requirements

- Foundry
- Solidity 0.8.24
- Tempo-compatible Foundry tooling
- `forge-std` (vendored in `lib/forge-std`)

## Run contract tests

From this directory:

```bash
forge test -vvv
```

If `lib/forge-std` is missing:

```bash
forge install foundry-rs/forge-std
forge test -vvv
```

The tests cover the policy enforcement paths, including:

- Empty merchant allowlist
- Unauthorized spender
- Pause and close
- Validity window
- Lifetime spending cap
- Rate limit and window reset
- Treasury deposit and withdrawal

## Deployment script

The Moderato deployment script is:

```text
script/DeployModerato.s.sol:DeployMandateBookModerato
```

For a new deployment to Tempo Moderato:

```bash
export RPC_URL="https://rpc.moderato.tempo.xyz"

forge script script/DeployModerato.s.sol:DeployMandateBookModerato \
  --rpc-url "$RPC_URL" \
  --tempo.fee-token 0x20c0000000000000000000000000000000000000 \
  --broadcast \
  --verify
```

Set `DEPLOYER_PRIVATE_KEY` securely in the process environment before broadcasting if required by the script.

Never commit private keys, seed phrases, API credentials, or `.env` files.

**Important:** The V2 contract documented above is already deployed. Do not run the deployment command merely to update documentation. A new deployment creates a different contract address and does not update the existing deployment.

For Tempo Mainnet (Chain ID `4217`), the repository provides a separate mainnet deployment script:

```text
script/Deploy.s.sol:DeployScript
```

Review the script and network checks before any mainnet deployment. The current V2 deployment documented in this file is on Moderato testnet.

## Important accounting model

MandateBook does not create an independent escrow for each mandate.

The treasury is shared. Each mandate reserves a portion of the available token balance through its spending cap.

For example:

```text
Treasury funded:            200 PATH_USD
Mandate #1 spending cap:    100 PATH_USD
Unencumbered treasury:     100 PATH_USD
```

The mandate's `remaining` value is the unused policy allowance, not a separately held token balance.

Finance controls deposits and withdrawals. Agents cannot withdraw treasury funds.

## License

Apache-2.0
