import assert from 'assert';
import { Receiver, Sender, Packet } from '../src';

const sleep = (ms: number) => new Promise((cb) => setTimeout(cb, ms));

describe('Receiver & Sender (integration test)', () => {
  it("sends and receives packets on the universes it's meant to listen on", async () => {
    const Tx1 = new Sender({ universe: 1 });
    const Tx2 = new Sender({ universe: 2 });
    const Rx = new Receiver({
      universes: [1, 3], // not listening to universe 2
    });
    try {
      const received: Packet[] = [];
      Rx.on('packet', (packet) => received.push(packet));
      Rx.on('PacketCorruption', console.error);
      Rx.on('PacketOutOfOrder', console.error);

      // stuff takes time
      await sleep(3500);
      await Tx1.send({ payload: { 1: 100 } });
      await Tx1.send({ payload: { 4: 25.1, 5: 0 } });
      await Tx2.send({ payload: { 512: 100 } });
      await sleep(3500);

      assert.strictEqual(received.length, 2);
      assert.deepStrictEqual(received[0]!.payload, { 1: 100 });
      assert.deepStrictEqual(received[1]!.payload, { 4: 25.1 });
    } finally {
      Tx1.close();
      Tx2.close();
      Rx.close();
    }
  });

  it('re-sends the packet data if minRefreshRate is supplied', async () => {
    const Tx = new Sender({ universe: 1, minRefreshRate: 1 });
    const Rx = new Receiver({ universes: [1] });
    try {
      const received: Packet[] = [];
      Rx.on('packet', (packet) => received.push(packet));

      // stuff takes time
      await sleep(3500);
      await Tx.send({ payload: { 1: 100 } });
      await sleep(3500);

      assert.strictEqual(received.length, 4); // send at 0s, 1s, 2s, 3s. Then at 3.5s we stop
      assert.deepStrictEqual(received[0]!.payload, { 1: 100 });
      assert.deepStrictEqual(received[1]!.payload, { 1: 100 });
      assert.deepStrictEqual(received[2]!.payload, { 1: 100 });
      assert.deepStrictEqual(received[3]!.payload, { 1: 100 });

      // ensure it sends a different packet each time - the sequence is incremented
      assert.deepStrictEqual(received[0]!.sequence, 0);
      assert.deepStrictEqual(received[1]!.sequence, 1);
      assert.deepStrictEqual(received[2]!.sequence, 2);
      assert.deepStrictEqual(received[3]!.sequence, 3);
    } finally {
      Tx.close();
      Rx.close();
    }
  });

  it('throws a catchable error when an invalid interface is supplied', async () => {
    const sACN = new Receiver({
      universes: [1],
      iface: '/dev/null',
    });
    try {
      const errors: Error[] = [];
      sACN.on('error', (ex) => errors.push(ex));

      // stuff takes time
      await sleep(500);

      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0]!.message, 'addMembership EINVAL');
    } finally {
      sACN.close();
    }
  });

  it('has working addUniverse and removeUniverse methods', async () => {
    const sACN = new Receiver({
      universes: [1, 2, 500],
    });
    try {
      await sleep(500);
      assert.deepStrictEqual(sACN.universes, [1, 2, 500]);

      sACN.addUniverse(4);
      await sleep(500);
      assert.deepStrictEqual(sACN.universes, [1, 2, 500, 4]);

      sACN.addUniverse(4); // making sure there's no error re-adding something
      await sleep(500);
      assert.deepStrictEqual(sACN.universes, [1, 2, 500, 4]);

      sACN.removeUniverse(500);
      await sleep(500);
      assert.deepStrictEqual(sACN.universes, [1, 2, 4]);

      sACN.removeUniverse(123); // making sure there's no error deleting something non-existant
      await sleep(500);
      assert.deepStrictEqual(sACN.universes, [1, 2, 4]);
    } finally {
      sACN.close();
    }
  });
});
