export function multicastGroup(universe: number): string {
  if ((universe > 0 && universe <= 63999) || universe === 64214) {
    // eslint-disable-next-line no-bitwise
    return `239.255.${universe >> 8}.${universe & 255}`;
  }
  throw new RangeError('universe must be between 1-63999');
}

export function objectify(buf: Buffer): Record<number, number> {
  const data = {};
  buf.forEach((val, ch) => {
    if (val > 0) data[ch + 1] = Math.round(val / 2.55);
  });
  return data;
}
