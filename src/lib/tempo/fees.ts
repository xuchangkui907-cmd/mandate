import { TEMPO } from "./constants";

/**
 * Tempo fees are attodollars (1e-18 USD) per gas.
 * TIP-20 uses 6 decimals (microdollars). Conversion:
 *   micro = ceil(baseFeePerGas * gasUsed / 1e12)
 * A 50k-gas TIP-20 transfer is ~$0.0006 at the cap.
 */
export function feeMicro(gasUsed: number, baseFeePerGas = TEMPO.baseFeePerGas): number {
  const atto = baseFeePerGas * gasUsed;
  return Math.ceil(atto / 1e12);
}

export function formatFee(micro: number): string {
  if (micro < 1_000) return `$${ (micro / 1_000_000).toFixed(6) }`;
  return `$${ (micro / 1_000_000).toFixed(4) }`;
}
