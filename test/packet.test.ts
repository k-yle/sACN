import assert from 'assert';
import { Packet } from '../src/packet';
import { buff } from './validBuffer';

const PAYLOAD = { 1: 91.76, 2: 100, 4: 100 };

describe('Simple Packet', () => {
  it('Correctly sets metadata from a given buffer', () => {
    const packet = new Packet(buff, '10.0.225.7');
    assert.strictEqual(packet.universe, 1);
    assert.strictEqual(packet.sourceName, 'Onyx');
    assert.strictEqual(packet.sequence, 172);

    assert.strictEqual(packet.sourceAddress, '10.0.225.7');
    assert.strictEqual(packet.priority, 100);

    assert.deepStrictEqual(packet.payload, PAYLOAD);
    const payloadAsArray = [...(<Buffer>packet.payloadAsBuffer)];
    payloadAsArray.length = 6; // let's not check the entire thing
    assert.deepStrictEqual(payloadAsArray, [234, 255, 0, 255, 0, 0]);
  });

  it('Returns the same buffer as supplied', () => {
    const packet = new Packet(buff);
    assert.deepStrictEqual(packet.buffer, buff);
  });

  it('throws if instantiated with no value', () => {
    assert.throws(() => {
      // @ts-expect-error we're testing if it throws
      // eslint-disable-next-line no-new
      new Packet();
    });
  });

  it('Can create a valid buffer from options', () => {
    const packet = new Packet({
      sourceName: 'Onyx',
      universe: 1,
      sequence: 172,
      priority: 100,
      payload: PAYLOAD,
      cid: Buffer.from([
        168, 19, 166, 93, 17, 41, 81, 64, 185, 113, 133, 166, 110, 170, 141, 79,
      ]),
    });
    assert.deepStrictEqual(packet.buffer, buff);
    assert.deepStrictEqual(packet.payloadAsBuffer, null); // not available when creating a packet from options
  });

  it('ignores invalid channels', () => {
    const packet = new Packet({
      universe: 1,
      payload: {
        513: 100,
      },
      sequence: 172,
    });
    // double wrapped so that it converts to buffer and back
    assert.deepStrictEqual(new Packet(packet.buffer).payload, {});
  });
});
