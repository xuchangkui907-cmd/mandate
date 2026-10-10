import assert from "node:assert/strict";
import { test } from "node:test";
import { addressFrom } from "./hash";
import { MERCHANTS, MICRO, REVERT, TEMPO } from "./constants";
import { issueMandate, pay, setMerchant, type BookState } from "./mandate";
import { memoFromChallenge } from "./mpp";

function book(): BookState {
  return {
    owner: addressFrom("owner"),
    nextId: 1,
    mandates: {},
    balances: { [TEMPO.pathUsd]: 1_000 * MICRO },
    blockNumber: 1,
  };
}

test("empty allowlist reverts MerchantNotAllowed", () => {
  const issued = issueMandate(book(), {
    spender: addressFrom("agent"),
    spenderLabel: "Helios",
    token: TEMPO.pathUsd,
    spendMax: 50 * MICRO,
    validAfter: 0,
    validUntil: Date.now() + 86_400_000,
    rateLimit: 10 * MICRO,
    window: 3_600_000,
    department: "research",
    allowlist: [],
  });
  assert.ok(!("error" in issued));
  const result = pay({
    state: issued.state,
    id: issued.mandate.id,
    spender: addressFrom("agent"),
    merchant: MERCHANTS.helios.address,
    amount: MERCHANTS.helios.priceMicro,
    memo: memoFromChallenge("ch_test"),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.revert, REVERT.MerchantNotAllowed);
});

test("allowlisted merchant settles and draws the cap", () => {
  const issued = issueMandate(book(), {
    spender: addressFrom("agent"),
    spenderLabel: "Helios",
    token: TEMPO.pathUsd,
    spendMax: 50 * MICRO,
    validAfter: 0,
    validUntil: Date.now() + 86_400_000,
    rateLimit: 10 * MICRO,
    window: 3_600_000,
    department: "research",
    allowlist: [],
  });
  assert.ok(!("error" in issued));
  const listed = setMerchant(issued.state, issued.mandate.id, MERCHANTS.helios.address, true);
  assert.ok(!("error" in listed));
  const result = pay({
    state: listed,
    id: issued.mandate.id,
    spender: addressFrom("agent"),
    merchant: MERCHANTS.helios.address,
    amount: MERCHANTS.helios.priceMicro,
    memo: memoFromChallenge("ch_ok"),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.remaining, 50 * MICRO - MERCHANTS.helios.priceMicro);
    assert.equal(result.lane, "payment");
  }
});
