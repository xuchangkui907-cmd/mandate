import test from "node:test";
import assert from "node:assert/strict";
import { authorizeRelayerRequest, isValidRelayerChallengeId } from "./relayer-auth.ts";

const VALID_KEY = "a".repeat(64);

function request(authorization?: string): Request {
  return new Request("http://localhost/api/relayer/action", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

async function withKey<T>(
  key: string | undefined,
  run: () => Promise<T> | T
): Promise<T> {
  const previous = process.env.MPP_RELAYER_API_KEY;

  if (key === undefined) {
    delete process.env.MPP_RELAYER_API_KEY;
  } else {
    process.env.MPP_RELAYER_API_KEY = key;
  }

  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.MPP_RELAYER_API_KEY;
    } else {
      process.env.MPP_RELAYER_API_KEY = previous;
    }
  }
}

test("missing server key returns 503", async () => {
  await withKey(undefined, async () => {
    const response = authorizeRelayerRequest(request(`Bearer ${VALID_KEY}`));
    assert.equal(response?.status, 503);
  });
});

test("short server key returns 503", async () => {
  await withKey("short-key", async () => {
    const response = authorizeRelayerRequest(request("Bearer short-key"));
    assert.equal(response?.status, 503);
  });
});

test("missing Authorization returns 401", async () => {
  await withKey(VALID_KEY, async () => {
    const response = authorizeRelayerRequest(request());
    assert.equal(response?.status, 401);
  });
});

test("malformed Bearer header returns 401", async () => {
  await withKey(VALID_KEY, async () => {
    const response = authorizeRelayerRequest(request(`Basic ${VALID_KEY}`));
    assert.equal(response?.status, 401);
  });
});

test("wrong key returns 401", async () => {
  await withKey(VALID_KEY, async () => {
    const response = authorizeRelayerRequest(request(`Bearer ${"b".repeat(64)}`));
    assert.equal(response?.status, 401);
  });
});

test("correct key passes authorization", async () => {
  await withKey(VALID_KEY, async () => {
    const response = authorizeRelayerRequest(request(`Bearer ${VALID_KEY}`));
    assert.equal(response, null);
  });
});


test("accepts generated challenge IDs for supported resources", () => {
  assert.equal(isValidRelayerChallengeId("mpp_helios_0123456789abcdef0123456789abcdef"), true);
  assert.equal(isValidRelayerChallengeId("mpp_atlas_0123456789abcdef0123456789abcdef"), true);
  assert.equal(isValidRelayerChallengeId("mpp_shadow_0123456789abcdef0123456789abcdef"), true);
});

test("rejects malformed challenge IDs", () => {
  for (const value of [
    "",
    "mpp_unknown_0123456789abcdef0123456789abcdef",
    "mpp_helios_0123456789abcdef0123456789abc",
    "mpp_helios_0123456789abcdef0123456789abcdef0",
    "mpp_helios_0123456789ABCDEF",
    "mpp_helios_012345678g",
    123,
    null,
    {},
    [],
  ]) {
    assert.equal(isValidRelayerChallengeId(value), false, String(value));
  }
});
