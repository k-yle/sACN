export const ACN_PID = Buffer.from([
  0x41, // A
  0x53, // S
  0x43, // C
  0x2d, // -
  0x45, // E
  0x31, // 1
  0x2e, // .
  0x31, // 1
  0x37, // 7
  0x00,
  0x00,
  0x00,
]);

/**
 * "The CID shall be a UUID [...] that is a 128-bit number / Each piece
 * of equipment should maintain the same CID for its entire lifetime"
 * - E1.31
 */
export const DEFAULT_CID = Buffer.from([
  0x6b, 0x79, 0x6c, 0x65, 0x48, 0x65, 0x6e, 0x73, 0x65, 0x6c, 0x44, 0x65, 0x66,
  0x61, 0x75, 0x6c,
]);

export enum RootVector {
  DATA = 4,
  EXTENDED = 8,
}
export enum FrameVector {
  DATA = 2,
}
export enum DmpVector {
  DATA = 2,
}

// export enum ExtendedFrameVector { SYNC = 1, DISCOVERY = 2 }
