/** Deterministic 32-byte hex from a seed. Not keccak — stable for the in-browser VM. */
export function digest(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i * 17;
    h2 = Math.imul(h2, 16777619);
  }
  const extra = `${h1 >>> 0}${h2 >>> 0}${seed.length}`;
  for (let i = 0; i < extra.length; i++) {
    h1 ^= extra.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0");
  const b = (h2 >>> 0).toString(16).padStart(8, "0");
  const c = ((h1 ^ h2) >>> 0).toString(16).padStart(8, "0");
  const d = (Math.imul(h1, h2) >>> 0).toString(16).padStart(8, "0");
  return (a + b + c + d).repeat(2).slice(0, 64);
}

export function addressFrom(seed: string): `0x${string}` {
  return `0x${digest(`addr:${seed}`).slice(0, 40)}`;
}

export function bytes32From(seed: string): `0x${string}` {
  return `0x${digest(`b32:${seed}`)}`;
}

export function txHashFrom(seed: string): `0x${string}` {
  return `0x${digest(`tx:${seed}:${Date.now()}:${Math.random()}`)}`;
}

export function txHashDeterministic(seed: string): `0x${string}` {
  return `0x${digest(`tx:${seed}`)}`;
}
