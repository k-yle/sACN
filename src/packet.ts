/**
 * this is the low-level implementation of the E1.31 (sACN) protocol
 */

import * as assert from 'assert';

/* eslint-disable lines-between-class-members, no-bitwise, no-control-regex */

const ACN_PID = Buffer.from([
  0x41, 0x53, 0x43, 0x2d, 0x45, 0x31, 0x2e, 0x31, 0x37, 0x00, 0x00, 0x00,
]);

enum RootVector { DATA = 4, EXTENDED = 8 }
enum FrameVector { DATA = 2 }
enum DmpVector { DATA = 2 }

// enum ExtendedFrameVector { SYNC = 1, DISCOVERY = 2 }

export default class Packet {
  /* root layer */
  private root_vector: RootVector;
  private root_fl: number;
  private preambleSize: number;
  private postambleSize: number;
  private acnPid: Buffer;
  cid: Buffer; // unique id of the sender

  /* framing layer */
  private frame_vector: FrameVector;
  private frame_fl: number;
  options: number;
  sequence: number;
  sourceName: string;
  priority: number; // 0 to 200; default 100
  syncUniverse: number; // universe used for annoucing timesync
  universe: number;

  /* DMP layer */
  private dmp_vector: DmpVector;
  private dmp_fl: number;
  private type: number;
  private firstAddress: number;
  private addressIncrement: number;
  propertyValueCount: number;
  private startCode: number;
  slotsData: Buffer;

  public constructor(private buffer: Buffer, public sourceAddress?: string) {
    /* root layer */
    this.root_vector = this.buffer.readUInt32BE(18);
    this.root_fl = this.buffer.readUInt16BE(16);
    this.acnPid = this.buffer.slice(4, 16);
    this.preambleSize = this.buffer.readUInt16BE(0);
    this.postambleSize = this.buffer.readUInt16BE(2);
    this.cid = this.buffer.slice(22, 38);

    /* frame layer */
    this.frame_vector = this.buffer.readUInt32BE(40);
    this.frame_fl = this.buffer.readUInt16BE(38);
    this.options = this.buffer.readUInt8(112);
    this.sequence = this.buffer.readUInt8(111);
    this.sourceName = this.buffer.toString('ascii', 44, 107).replace(/\x00/g, '');
    this.priority = this.buffer.readUInt8(108);
    this.syncUniverse = this.buffer.readUInt16BE(109);
    this.universe = this.buffer.readUInt16BE(113);

    /* DMP layer */
    this.dmp_vector = this.buffer.readUInt8(117);
    this.dmp_fl = this.buffer.readUInt16BE(115);
    this.type = this.buffer.readUInt8(118);
    this.firstAddress = this.buffer.readUInt16BE(119);
    this.addressIncrement = this.buffer.readUInt16BE(121);
    this.propertyValueCount = this.buffer.readUInt16BE(123);
    this.startCode = this.buffer.readUInt8(125);
    this.slotsData = this.buffer.slice(126);

    this.validate();
  }

  private validate(): void|never {
    // ascertains that this packet implements ACN
    assert.deepStrictEqual(this.acnPid, ACN_PID);

    // ascertains that this packet is a DATA packet
    assert.strictEqual(this.root_vector, RootVector.DATA);
    assert.strictEqual(this.frame_vector, FrameVector.DATA);
    assert.strictEqual(this.dmp_vector, DmpVector.DATA);

    // constants within the UDP overhead
    assert.strictEqual(this.type, 0xa1); //= 61
    assert.strictEqual(this.firstAddress, 0);
    assert.strictEqual(this.addressIncrement, 1);
    assert.strictEqual(this.startCode, 0);
    assert.strictEqual(this.preambleSize, 0x0010); //= 16
    assert.strictEqual(this.postambleSize, 0);
  }

  // TODO: For octet 112 (options): Bit 7 = Preview_Data / Bit 6 = Stream_Terminated / Bit 5 = Force_Synchronization
  // public getOption(option: number): boolean {
  //   return !!(this.options & (1 << (option % 8)));
  // }
}
