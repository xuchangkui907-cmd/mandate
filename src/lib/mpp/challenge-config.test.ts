import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchesConfiguredAmount,
  matchesConfiguredMerchant,
  matchesMppChallengeConfig,
} from "./challenge-config.ts";

const expected = {
  resource: "helios",
  mandateId: "1",
  mandateBook: "0x1111111111111111111111111111111111111111",
  chainId: 42431,
  token: "0x2222222222222222222222222222222222222222",
  merchant: "0x3333333333333333333333333333333333333333",
  amount: 80_000n,
  expectedSpender: "0x4444444444444444444444444444444444444444",
};

describe("MPP challenge configuration binding", () => {
  it("accepts a fully matching challenge", () => {
    assert.equal(matchesMppChallengeConfig({ ...expected }, expected), true);
  });

  it("compares EVM addresses case-insensitively", () => {
    const upper = {
      ...expected,
      mandateBook: expected.mandateBook.toUpperCase().replace("0X", "0x"),
      token: expected.token.toUpperCase().replace("0X", "0x"),
      merchant: expected.merchant.toUpperCase().replace("0X", "0x"),
      expectedSpender: expected.expectedSpender.toUpperCase().replace("0X", "0x"),
    };
    assert.equal(matchesMppChallengeConfig(upper, expected), true);
  });

  const mismatches: Array<[string, Partial<typeof expected>]> = [
    ["resource", { resource: "atlas" }],
    ["mandateId", { mandateId: "2" }],
    ["MandateBook", { mandateBook: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    ["chainId", { chainId: 1 }],
    ["token", { token: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
    ["merchant", { merchant: "0xcccccccccccccccccccccccccccccccccccccccc" }],
    ["amount", { amount: 80_001n }],
    ["expectedSpender", { expectedSpender: "0xdddddddddddddddddddddddddddddddddddddddd" }],
  ];

  for (const [field, override] of mismatches) {
    it(`rejects a challenge with mismatched ${field}`, () => {
      assert.equal(
        matchesMppChallengeConfig({ ...expected, ...override }, expected),
        false,
      );
    });
  }
});

describe("Relayer resource configuration binding", () => {
  it("accepts the configured merchant regardless of address casing", () => {
    assert.equal(
      matchesConfiguredMerchant(expected.merchant.toUpperCase().replace("0X", "0x"), expected.merchant),
      true,
    );
  });

  it("rejects a changed merchant", () => {
    assert.equal(
      matchesConfiguredMerchant("0xcccccccccccccccccccccccccccccccccccccccc", expected.merchant),
      false,
    );
  });

  it("accepts the exact configured resource price", () => {
    assert.equal(matchesConfiguredAmount(80_000n, 80_000n), true);
  });

  it("rejects a stale or modified resource price", () => {
    assert.equal(matchesConfiguredAmount(80_001n, 80_000n), false);
  });
});
