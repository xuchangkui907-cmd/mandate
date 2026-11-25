# Mandate SDK

Tiny TypeScript helpers for MandateBook on Tempo (chainId 42431). Requires viem.

```ts
import { TEMPO_MODERATO, encodeIssueCalldata, encodePayCalldata, parseUnits6, challengeIdToMemo } from "./index";

const issue = encodeIssueCalldata({
  spender: AGENT, token: TEMPO_MODERATO.pathUSD, spendMax: parseUnits6("500"), maxPerTx: parseUnits6("1"),
  validAfter: 0n, validUntil: 1893456000n, rateLimit: parseUnits6("50"),
  window: 86400, department: "0x656e670000000000000000000000000000000000000000000000000000000000",
});
// Agent receives HTTP 402; pays the MPP challenge id as memo (never holds treasury keys).
const pay = encodePayCalldata({ id: 1n, merchant: MERCHANT, amount: parseUnits6("0.50"), memo: challengeIdToMemo(challengeId) });
```
