import assert from "node:assert/strict";
import test from "node:test";
import { parsePaymentAuthHeader } from "./payment-auth.ts";

const TX = `0x${"a".repeat(64)}`;
const ID = `mpp_helios_${"b".repeat(32)}`;

test("missing Authorization header requests a new challenge", () => {
  assert.deepEqual(parsePaymentAuthHeader(null, "helios"), {
    kind: "none",
  });
});

test("accepts a valid Tempo Payment header", () => {
  assert.deepEqual(
    parsePaymentAuthHeader(
      `Payment method="tempo", txHash="${TX}", challengeId="${ID}"`,
      "helios",
    ),
    {
      kind: "payment",
      txHash: TX,
      challengeId: ID,
    },
  );
});

test("accepts case-insensitive Payment scheme and parameter names", () => {
  assert.equal(
    parsePaymentAuthHeader(
      `payment METHOD=tempo, TXHASH=${TX}, CHALLENGEID=${ID}`,
      "helios",
    ).kind,
    "payment",
  );
});

test("rejects an unsupported authorization scheme", () => {
  assert.equal(
    parsePaymentAuthHeader(`Bearer ${TX}`, "helios").kind,
    "invalid",
  );
});

test("rejects an incomplete Payment header", () => {
  assert.equal(
    parsePaymentAuthHeader(`Payment method="tempo", txHash="${TX}"`, "helios").kind,
    "invalid",
  );
});

test("rejects a malformed transaction hash", () => {
  assert.equal(
    parsePaymentAuthHeader(
      `Payment method="tempo", txHash="0x1234", challengeId="${ID}"`,
      "helios",
    ).kind,
    "invalid",
  );
});

test("rejects duplicate parameters", () => {
  assert.equal(
    parsePaymentAuthHeader(
      `Payment method="tempo", txHash="${TX}", txHash="${TX}", challengeId="${ID}"`,
      "helios",
    ).kind,
    "invalid",
  );
});

test("rejects malformed parameter syntax", () => {
  assert.equal(
    parsePaymentAuthHeader(
      `Payment method="tempo", txHash="${TX}", broken, challengeId="${ID}"`,
      "helios",
    ).kind,
    "invalid",
  );
});

test("rejects a non-Tempo payment method", () => {
  assert.equal(
    parsePaymentAuthHeader(
      `Payment method="other", txHash="${TX}", challengeId="${ID}"`,
      "helios",
    ).kind,
    "invalid",
  );
});

test("rejects a challenge ID belonging to another resource", () => {
  assert.equal(
    parsePaymentAuthHeader(
      `Payment method="tempo", txHash="${TX}", challengeId="${ID}"`,
      "atlas",
    ).kind,
    "invalid",
  );
});

test("rejects uppercase or incorrectly sized challenge ID suffixes", () => {
  const invalidIds = [
    `mpp_helios_${"B".repeat(32)}`,
    `mpp_helios_${"b".repeat(16)}`,
    `mpp_helios_${"b".repeat(33)}`,
  ];

  for (const id of invalidIds) {
    assert.equal(
      parsePaymentAuthHeader(
        `Payment method="tempo", txHash="${TX}", challengeId="${id}"`,
        "helios",
      ).kind,
      "invalid",
      id,
    );
  }
});
