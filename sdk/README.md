# Mandate SDK

Tiny TypeScript helpers for MandateBook on Tempo (chainId 4217). No runtime deps.

```ts
import { encodeIssue, encodePay, TEMPO, parseUnits6 } from "./index";

const issue = encodeIssue({
  spender: AGENT, token: TEMPO.pathUSD, spendMax: parseUnits6("500"),
  validAfter: 0n, validUntil: 1893456000n, rateLimit: parseUnits6("50"),
  window: 86400, department: "0x656e670000000000000000000000000000000000000000000000000000000000",
});
// Agent receives HTTP 402; pays the MPP challenge id as memo (never holds treasury keys).
const pay = encodePay({ id: 1n, merchant: MERCHANT, amount: parseUnits6("0.50"), memo: challengeId });
```
