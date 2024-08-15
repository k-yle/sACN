/** Channel 1 is index 1. There is no index 0. The value range is `0-100` */
export type Payload = { [channel: number]: number };

export function multicastGroup(universe: number): string {
  if ((universe > 0 && universe <= 63999) || universe === 64214) {
    return `239.255.${universe >> 8}.${universe & 255}`;
  }
  throw new RangeError('universe must be between 1-63999');
}

export const dp = (n: number, decimals = 2): number =>
  Math.round(n * 10 ** decimals) / 10 ** decimals;

export function objectify(buf: Buffer): Payload {
  const data: Payload = {};
  for (const [ch, val] of buf.entries()) {
    if (val > 0) data[ch + 1] = dp(val / 2.55, 2); // rounding to 2dp will not lose any data
  }
  return data;
}

export const inRange = (n: number): number =>
  Math.min(255, Math.max(Math.round(n), 0));

export function bit(bitt: 8 | 16 | 24 | 32, num: number): number[] {
  if (bitt % 8) throw new Error('num of bits must be divisible by 8');

  const chunks: number[] = [];
  for (let i = 0; i < bitt; i += 8) {
    chunks.unshift((num >> i) & 255);
  }
  return chunks;
}

export const empty = (len: number): number[] => [
  ...new Uint8Array(new ArrayBuffer(len)),
];
