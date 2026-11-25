export interface MppChallengeConfig {
  resource: string;
  mandateId: string;
  mandateBook: string;
  chainId: number;
  token: string;
  merchant: string;
  amount: bigint;
  expectedSpender: string;
}

export function matchesMppChallengeConfig(
  challenge: MppChallengeConfig,
  expected: MppChallengeConfig,
): boolean {
  return (
    challenge.resource === expected.resource &&
    challenge.mandateId === expected.mandateId &&
    challenge.mandateBook.toLowerCase() === expected.mandateBook.toLowerCase() &&
    challenge.chainId === expected.chainId &&
    challenge.token.toLowerCase() === expected.token.toLowerCase() &&
    challenge.merchant.toLowerCase() === expected.merchant.toLowerCase() &&
    challenge.amount === expected.amount &&
    challenge.expectedSpender.toLowerCase() === expected.expectedSpender.toLowerCase()
  );
}

export function matchesConfiguredMerchant(
  challengeMerchant: string,
  expectedMerchant: string,
): boolean {
  return challengeMerchant.toLowerCase() === expectedMerchant.toLowerCase();
}

export function matchesConfiguredAmount(
  challengeAmount: bigint,
  expectedAmount: bigint,
): boolean {
  return challengeAmount === expectedAmount;
}
