# MandateBook

Policy-bound spend authorization for Tempo (chainId 4217). Finance deposits TIP-20 stablecoins into `MandateBook`. Each Mandate is a spend policy: who can pay, how much, to which merchants, until when, at what rate. Agents never hold treasury keys. An empty merchant allowlist is fail-closed.

## Test

```
forge test -vvv
```

Requires Foundry (solc 0.8.24). From this directory: `forge install foundry-rs/forge-std` if `lib/forge-std` is missing, then `forge test -vvv`.

## How this maps to MPP

Machine Payments Protocol: an agent requests a paid resource, the merchant returns HTTP 402 with a challenge, the agent pays on-chain with `memo = challenge id`, the merchant verifies the receipt and returns the resource.

`pay(id, merchant, amount, memo)` is that on-chain step. `memo` is the 32-byte MPP challenge id. Settlement uses TIP-20 `transferWithMemo`, which rides Tempo payment lanes (reserved blockspace, ~0.6s finality, fees in USD TIP-20). The book checks the mandate (spender, window, cap, allowlist) before moving funds; the agent key cannot withdraw the treasury.

## Tempo addresses (mainnet, same on testnet)

| Name | Address |
| --- | --- |
| TIP-20 Factory | `0x20Fc000000000000000000000000000000000000` |
| pathUSD | `0x20c0000000000000000000000000000000000000` |
| Fee Manager | `0xfeec000000000000000000000000000000000000` |

TIP-20 decimals are always 6. Chain id 4217. No native gas token.

## 16-day deploy notes

Day 1: `forge test -vvv`. Confirm empty-allowlist fail-closed and MPP memo passthrough.

Days 2-3: Deploy to Tempo testnet with `forge script script/Deploy.s.sol:DeployScript --rpc-url $TEMPO_RPC --broadcast`. Fund the deployer with test pathUSD (fees + treasury). Record the MandateBook address.

Days 4-6: Finance flow: `deposit(pathUSD, amount)`, `issue(...)`, `setMerchant`. Point the agent spender key at the issued id. Wire the SDK (`encodeIssue`, `encodePay`) to the 402 handler.

Days 7-10: Load test payment-lane settlement. Confirm `Paid` events index by challenge id. Pause / close runbooks for finance.

Days 11-13: Mainnet (4217) dry-run: small pathUSD deposit, one merchant, one MPP charge, withdraw leftover.

Days 14-16: Production: issue department-tagged mandates, keep allowlists explicit, never grant treasury keys to agents. Close spent mandates; withdraw idle pathUSD. Do not treat `remaining` as escrow — it is a policy cap over a shared treasury.
