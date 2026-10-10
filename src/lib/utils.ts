import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(micro: number): string {
  const sign = micro < 0 ? "-" : "";
  const abs = Math.abs(micro);
  const whole = Math.floor(abs / 1_000_000);
  const frac = String(abs % 1_000_000).padStart(6, "0");
  if (abs === 0) return `${sign}0.00`;
  if (whole === 0) {
    if (abs % 10_000 === 0) return `${sign}0.${frac.slice(0, 2)}`;
    const trimmed = frac.replace(/0+$/, "");
    return `${sign}0.${trimmed.length >= 4 ? trimmed : frac.slice(0, 4)}`;
  }
  return `${sign}${whole.toLocaleString("en-US")}.${frac.slice(0, 2)}`;
}

export function parseUsd(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!cleaned) return 0;
  const [w, f = ""] = cleaned.split(".");
  const whole = Number(w || "0");
  const frac = (f + "000000").slice(0, 6);
  return whole * 1_000_000 + Number(frac);
}

export function shortAddr(addr: string, size = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

export function shortHash(hash: string): string {
  if (!hash) return "";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}
