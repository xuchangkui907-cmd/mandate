import { TEMPO } from "./constants";
import { bytes32From } from "./hash";
import type { Address, MppChallenge } from "./types";

let challengeSeq = 0;

export function issueChallenge(args: {
  amount: number;
  recipient: Address;
  resource: string;
}): MppChallenge {
  challengeSeq += 1;
  const id = `ch_${challengeSeq.toString(16).padStart(4, "0")}_${Math.floor(Math.random() * 1e6).toString(16)}`;
  return {
    id,
    method: "tempo",
    amount: args.amount,
    currency: "USD",
    token: TEMPO.pathUsd,
    recipient: args.recipient,
    network: "tempo",
    chainId: TEMPO.chainId,
    expires: Date.now() + 120_000,
    resource: args.resource,
  };
}

export function challengeHeader(ch: MppChallenge): string {
  const params = [
    `method="${ch.method}"`,
    `challenge="${ch.id}"`,
    `amount="${ch.amount}"`,
    `currency="${ch.currency}"`,
    `token="${ch.token}"`,
    `recipient="${ch.recipient}"`,
    `chain-id="${ch.chainId}"`,
  ].join(", ");
  return `Payment ${params}`;
}

export function memoFromChallenge(id: string): `0x${string}` {
  return bytes32From(`mpp:${id}`);
}

export function credentialHeader(mandateId: number, txHash: string, challengeId: string): string {
  return `Payment challenge="${challengeId}", tx="${txHash}", mandate="${mandateId}"`;
}

export function receiptHeader(args: {
  challengeId: string;
  txHash: string;
  amount: number;
  blockNumber: number;
}): string {
  return `tempo challenge="${args.challengeId}"; tx=${args.txHash}; amount=${args.amount}; block=${args.blockNumber}; finality=600ms`;
}
