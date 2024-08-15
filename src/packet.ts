/**
 * this is the low-level implementation of the E1.31 (sACN) protocol
 */

import assert from 'assert';
import { type Payload, bit, empty, inRange, objectify } from './util';
import {
  ACN_PID,
  DEFAULT_CID,
  DmpVector,
  FrameVector,
  RootVector,
} from './constants';

export interface Options {
  universe: Packet['universe'];
  payload: Packet['payload'];
  sequence: Packet['sequence'];
  sourceName?: Packet['sourceName'];
  priority?: Packet['priority'];
  cid?: Packet['cid'];
  /**
   * Whether to use 0-100 or 0-255 scale when creating the packet
   * - `false` (default): 0-100
   * - `true`: 0-255
   */
  useRawDmxValues?: Packet['useRawDmxValues'];
}

/**
 * This constructs a sACN Packet, either from an
 * existing `Buffer` or from `Options`.
 */
export class Packet {
  /* eslint-disable lines-between-class-members */

  /* root layer */
  private readonly root_vector = RootVector.DATA;
  private readonly root_fl: number;
  private readonly preambleSize = 0x0010; // =16 (unit16 hence the redundant 00s)
  private readonly postambleSize = 0;
  private readonly acnPid = ACN_PID;
  public readonly cid: Buffer; // unique id of the sender

  /* framing layer */
  private readonly frame_vector = FrameVector.DATA;
  private readonly frame_fl: number;
  public readonly options: number;
  public readonly sequence: number;
  public readonly sourceName: string;
  public readonly priority: number; // 0 to 200; default 100
  public readonly syncUniverse: number; // universe used for annoucing timesync
  public readonly universe: number;

  /* DMP layer */
  private readonly dmp_vector = DmpVector.DATA;
  private readonly dmp_fl: number;
  private readonly type = 0xa1; // = 61
  private readonly firstAddress = 0;
  private readonly addressIncrement = 1;
  public readonly propertyValueCount: number;
  private readonly startCode = 0;
  private readonly privatePayload: Buffer | Payload;

  /* eslint-enable lines-between-class-members */

  private readonly useRawDmxValues: boolean = false;

  public constructor(
    input: Buffer | Options,
    public readonly sourceAddress?: string,
  ) {
    if (!input) throw new Error('Buffer packet instantiated with no value');
    if (input instanceof Buffer) {
      const buf = input;
      // If a buffer is supplied, ascertain that the packet implements ACN
      // correctly, and that is it a data packet. Also asceratain that the
      // UDP overhead is valid. Then fill up the class values.

      /* root layer */
      assert.strictEqual(buf.readUInt32BE(18), this.root_vector);
      this.root_fl = buf.readUInt16BE(16);
      assert.deepStrictEqual(buf.slice(4, 16), this.acnPid);
      assert.strictEqual(buf.readUInt16BE(0), this.preambleSize);
      assert.strictEqual(buf.readUInt16BE(2), this.postambleSize);
      this.cid = buf.slice(22, 38);

      /* frame layer */
      assert.strictEqual(buf.readUInt32BE(40), this.frame_vector);
      this.frame_fl = buf.readUInt16BE(38);
      this.options = buf.readUInt8(112);
      this.sequence = buf.readUInt8(111);
      // eslint-disable-next-line no-control-regex, unicorn/no-hex-escape
      this.sourceName = buf.toString('ascii', 44, 107).replace(/\x00/g, '');
      this.priority = buf.readUInt8(108);
      this.syncUniverse = buf.readUInt16BE(109);
      this.universe = buf.readUInt16BE(113);

      /* DMP layer */
      assert.strictEqual(buf.readUInt8(117), this.dmp_vector);
      this.dmp_fl = buf.readUInt16BE(115);
      assert.strictEqual(buf.readUInt8(118), this.type);
      assert.strictEqual(buf.readUInt16BE(119), this.firstAddress);
      assert.strictEqual(buf.readUInt16BE(121), this.addressIncrement);
      this.propertyValueCount = buf.readUInt16BE(123);
      assert.strictEqual(buf.readUInt8(125), this.startCode);
      this.privatePayload = buf.slice(126);
    } else {
      // if input is not a buffer
      const options = input;

      // set constants
      this.preambleSize = 0x0010;
      this.root_fl = 0x726e;
      this.frame_fl = 0x7258;
      this.dmp_fl = 0x720b;
      this.syncUniverse = 0; // we as a sender don't implement this
      this.options = 0; // TODO: can we just set to 0?

      // set properties
      this.privatePayload = options.payload;
      this.sourceName = options.sourceName || 'sACN nodejs';
      this.priority = options.priority || 100;
      this.sequence = options.sequence;
      this.universe = options.universe;
      this.cid = options.cid || DEFAULT_CID;

      // set computed properties
      this.propertyValueCount = 0x0201; // "Indicates 1+ the number of slots in packet"
      // We set the highest possible value (1+512) so that channels with zero values are
      // treated as deliberately 0 (cf. undefined)

      if (options.useRawDmxValues) {
        this.useRawDmxValues = true;
      }
    }
  }

  public get payload(): Payload {
    return this.privatePayload instanceof Buffer
      ? objectify(this.privatePayload)
      : this.privatePayload;
  }

  public get payloadAsBuffer(): Buffer | null {
    return this.privatePayload instanceof Buffer ? this.privatePayload : null;
  }

  public get buffer(): Buffer {
    const sourceNameBuf = Buffer.from(this.sourceName.padEnd(64, '\0'));
    // eslint-disable-next-line unicorn/prefer-spread -- more readabile this way
    const n = (<number[]>[]).concat(
      /* root layer */
      bit(16, this.preambleSize), // 0,1 = preable size
      bit(16, this.postambleSize), // 2,3 = postamble size
      [...this.acnPid],
      bit(16, this.root_fl), // 16,17 = root fl
      bit(32, this.root_vector), // 18,19,20,21 = Root_vector
      [...this.cid], // 22-37 = cid

      /* framing layer */
      bit(16, this.frame_fl), // 38,39 = frame fl
      bit(32, this.frame_vector), // 40,41,42,43 = frame vector
      [...sourceNameBuf], // 44 - 107 = sourceName
      bit(8, this.priority), // 108 = priority (8bit)
      bit(16, this.syncUniverse), // 109,110 = syncUniverse
      bit(8, this.sequence), // 111 = sequence
      bit(8, this.options), // 112 = options
      bit(16, this.universe), // 113,114 = universe

      /* DMP layer */
      bit(16, this.dmp_fl), // 115,116 = dmp_fl
      bit(8, this.dmp_vector), // 117 = dmp vector
      bit(8, this.type), // 118 = type
      bit(16, this.firstAddress), // 119,120 = first adddress
      bit(16, this.addressIncrement), // 121,122 = addressIncrement
      bit(16, this.propertyValueCount), // 123,124 = propertyValueCount
      bit(8, this.startCode), // 125 = startCode
      empty(512), // 126-638 = dmx channels 1-512
    );

    for (const ch in this.payload) {
      if (+ch >= 1 && +ch <= 512) {
        if (this.useRawDmxValues) {
          n[125 + +ch] = inRange(this.payload[ch]!);
        } else {
          n[125 + +ch] = inRange(this.payload[ch]! * 2.55);
        }
      }
    }

    return Buffer.from(n);
  }

  // TODO: For octet 112 (options): Bit 7 = Preview_Data / Bit 6 = Stream_Terminated / Bit 5 = Force_Synchronization
  // public getOption(option: number): boolean {
  //   return !!(this.options & (1 << (option % 8)));
  // }
}
