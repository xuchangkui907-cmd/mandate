import { timingSafeEqual } from "node:crypto";

export function authorizeRelayerRequest(request: Request): Response | null {
  const expectedKey = process.env.MPP_RELAYER_API_KEY;

  if (!expectedKey || expectedKey.length < 32) {
    return Response.json(
      { error: "Relayer API key is not configured" },
      { status: 503 }
    );
  }

  const match = /^Bearer ([^\s]+)$/i.exec(
    request.headers.get("authorization") ?? ""
  );

  if (!match) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const expected = Buffer.from(expectedKey, "utf8");
  const provided = Buffer.from(match[1], "utf8");

  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null;
}


const RELAYER_CHALLENGE_ID_PATTERN =
  /^mpp_(?:helios|atlas|shadow)_[a-f0-9]{32}$/;

export function isValidRelayerChallengeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    RELAYER_CHALLENGE_ID_PATTERN.test(value)
  );
}
