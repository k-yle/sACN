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
  buf.forEach((val, ch) => {
    if (val > 0) data[ch + 1] = dp(val / 2.55, 2); // rounding to 2dp will not lose any data
  });
  return data;
}

export const inRange = (n: number): number =>
  Math.min(255, Math.max(Math.round(n), 0));

export function bit(bitt: 8 | 16 | 32, num: number): number[] {
  // we could just do a _bit_ of shifting here instead :P
  // e.g. (0x1234 >> 8) & 255
  const arr = new ArrayBuffer(bitt / 8);

  // this mutates `arr`
  const view = new DataView(arr);
  view[<const>`setUint${bitt}`](0, num, false); // ByteOffset = 0; litteEndian = false

  return Array.from(new Uint8Array(arr));
}
export const empty = (len: number): number[] =>
  Array.from(new Uint8Array(new ArrayBuffer(len)));
