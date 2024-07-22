import assert from 'assert';
import { networkInterfaces } from 'os';
import { type Packet, Receiver, Sender } from '../src';

// @ts-expect-error -- polyfill
Symbol.dispose ||= Symbol('dispose');

// TODO: switch to `node:timers/promises` once we drop support for node14
const sleep = (ms: number) => new Promise((cb) => setTimeout(cb, ms));

function collectErrors(Rx: Receiver, errors: Error[]) {
  Rx.on('error', (ex) => errors.push(ex));
  Rx.on('PacketCorruption', (ex) => errors.push(ex));
  Rx.on('PacketOutOfOrder', (ex) => errors.push(ex));
}

describe('Receiver & Sender (integration test)', () => {
  it("sends and receives packets on the universes it's meant to listen on", async () => {
    const Tx1 = new Sender({ universe: 1, reuseAddr: true });
    const Tx2 = new Sender({ universe: 2, reuseAddr: true });
    const Rx = new Receiver({
      universes: [1, 3], // not listening to universe 2
      reuseAddr: true,
    });
    try {
      const received: Packet[] = [];
      const errors: Error[] = [];
      Rx.on('packet', (packet) => received.push(packet));
      collectErrors(Rx, errors);

      // stuff takes time
      await sleep(3500);
      await Tx1.send({ payload: { 1: 100 } });
      await Tx1.send({ payload: { 4: 25.1, 5: 0 } });
      await Tx2.send({ payload: { 512: 100 } });
      await sleep(3500);

      assert.strictEqual(errors.length, 0);
      assert.strictEqual(received.length, 2);
      assert.deepStrictEqual(received[0]!.payload, { 1: 100 });
      assert.deepStrictEqual(received[1]!.payload, { 4: 25.1 });
    } finally {
      Tx1.close();
      Tx2.close();
      Rx.close();
    }
  });

  it('supports Symbol.dispose', async () => {
    using Tx1 = new Sender({ universe: 1, reuseAddr: true });
    using Tx2 = new Sender({ universe: 2, reuseAddr: true });
    using Rx = new Receiver({
      universes: [1, 3], // not listening to universe 2
      reuseAddr: true,
    });

    const received: Packet[] = [];
    const errors: Error[] = [];
    Rx.on('packet', (packet) => received.push(packet));
    collectErrors(Rx, errors);

    // stuff takes time
    await sleep(3500);
    await Tx1.send({ payload: { 1: 100 } });
    await Tx1.send({ payload: { 4: 25.1, 5: 0 } });
    await Tx2.send({ payload: { 512: 100 } });
    await sleep(3500);

    assert.strictEqual(errors.length, 0);
    assert.strictEqual(received.length, 2);
    assert.deepStrictEqual(received[0]!.payload, { 1: 100 });
    assert.deepStrictEqual(received[1]!.payload, { 4: 25.1 });
  });

  it('re-sends the packet data if minRefreshRate is supplied', async () => {
    const Tx = new Sender({ universe: 1, minRefreshRate: 1, reuseAddr: true });
    const Rx = new Receiver({ universes: [1], reuseAddr: true });
    try {
      const received: Packet[] = [];
      const errors: Error[] = [];
      const receivedEvents: boolean[] = [];
      Tx.on('changedResendStatus', (event) => receivedEvents.push(event));
      Tx.on('error', (ex) => errors.push(ex));
      Rx.on('packet', (packet) => received.push(packet));
      collectErrors(Rx, errors);

      // stuff takes time
      await sleep(3500);
      await Tx.send({ payload: { 1: 100 } });
      await sleep(3500);

      assert.strictEqual(errors.length, 0);
      assert.strictEqual(received.length, 4); // send at 0s, 1s, 2s, 3s. Then at 3.5s we stop
      assert.strictEqual(receivedEvents.length, 1);
      assert.deepStrictEqual(receivedEvents[0], true);
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
      reuseAddr: true,
    });
    try {
      const errors: Error[] = [];
      collectErrors(sACN, errors);

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
      reuseAddr: true,
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

  it('does not throw PacketOutOfOrder errors when two senders are broadcasting onto the same universe', async () => {
    const Tx1 = new Sender({
      universe: 14,
      defaultPacketOptions: {
        cid: Buffer.from([0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        sourceName: 'grandMA3',
      },
      reuseAddr: true,
    });
    const Tx2 = new Sender({
      universe: 14,
      defaultPacketOptions: {
        cid: Buffer.from([0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        sourceName: 'RoadHog4',
      },
      reuseAddr: true,
    });
    const Rx = new Receiver({ universes: [14], reuseAddr: true });

    try {
      const received: Packet[] = [];
      const errors: Error[] = [];
      Rx.on('packet', (packet) => received.push(packet));
      collectErrors(Rx, errors);

      await Tx1.send({ payload: { 1: 100 } }); // 0
      await Tx1.send({ payload: { 1: 0 } }); // 1
      await Tx1.send({ payload: { 1: 100 } }); // 2

      await Tx2.send({ payload: { 1: 99 } }); // 0
      await Tx2.send({ payload: { 1: 98 } }); // 1
      await Tx2.send({ payload: { 1: 97 } }); // 2

      await Tx1.send({ payload: { 1: 50 } }); // 3
      await Tx2.send({ payload: { 1: 96 } }); // 3

      // stuff takes time
      await sleep(3500);

      // ensure the sequence is incremented per-sender, and that the order matches the order above
      assert.deepStrictEqual(
        received.map((r) => `${r.sourceName} - #${r.sequence}`),
        [
          'grandMA3 - #0',
          'grandMA3 - #1',
          'grandMA3 - #2',
          'RoadHog4 - #0',
          'RoadHog4 - #1',
          'RoadHog4 - #2',
          'grandMA3 - #3',
          'RoadHog4 - #3',
        ],
      );

      // ensure no errors were thrown
      assert.deepStrictEqual(errors, []);
    } finally {
      Tx1.close();
      Tx2.close();
      Rx.close();
    }
  });

  it('throws a PacketOutOfOrder errors when there is genuinely an issue', async () => {
    // these two senders have a same CID and sourceName, which will cause a genuine PacketOutOfOrder
    // error on the receiver's side.
    const Tx1 = new Sender({
      universe: 5,
      defaultPacketOptions: {
        cid: Buffer.from([0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        sourceName: 'Full Boar 4',
      },
      reuseAddr: true,
    });
    const Tx2 = new Sender({
      universe: 5,
      defaultPacketOptions: {
        cid: Buffer.from([0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        sourceName: 'Full Boar 4',
      },
      reuseAddr: true,
    });
    const Rx = new Receiver({ universes: [5], reuseAddr: true });

    try {
      const received: Packet[] = [];
      const errors: Error[] = [];

      Rx.on('packet', (packet) => received.push(packet));
      collectErrors(Rx, errors);

      // send 25 packets from Tx1
      for (let i = 0; i < 25; i += 1) {
        await Tx1.send({ payload: { 1: i } });
      }
      // then send 5 packets from Tx2
      for (let i = 0; i < 5; i += 1) {
        await Tx2.send({ payload: { 1: i } });
      }

      // stuff takes time
      await sleep(3500);

      // confirm that 29 packets were recevied successfully, and that only the first
      // packet from Tx2 was dropped when it switched over to the new numbering system.
      assert.deepStrictEqual(
        received.map((r) => r.sequence),
        [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
          20, 21, 22, 23, 24, 1, 2, 3, 4,
        ],
      );

      // at least one error is thrown
      assert.strictEqual(errors.length >= 1, true);
      assert.strictEqual(
        errors[0]!.message,
        'Packet significantly out of order in universe 5 from Full Boar 4 (24 -> 0)',
      );
    } finally {
      Tx1.close();
      Tx2.close();
      Rx.close();
    }
  });
});

describe('Sending to a specific interface', () => {
  const [i1, i2] = Object.values(networkInterfaces())
    .map((addrs) => addrs!.find((a) => a.family === 'IPv4')?.address)
    .filter((ip): ip is string => !!ip && ip !== '127.0.0.1');

  console.log('Broadcasting to', [i1, i2]);

  if (!i1 || !i2) {
    console.error(
      "Can't run some tests, machine doesn't have two IPv4 network interfaces",
    );
  }

  const maybeRunTest = i1 && i2 ? it : it.skip;

  maybeRunTest('can send data to a specific interface', async () => {
    const Tx1 = new Sender({ universe: 1, iface: i1, reuseAddr: true });
    const Tx2 = new Sender({ universe: 1, iface: i2, reuseAddr: true });
    const Rx1 = new Receiver({ universes: [1], iface: i1, reuseAddr: true });
    const Rx2 = new Receiver({ universes: [1], iface: i2, reuseAddr: true });
    try {
      const received1: Packet[] = [];
      const received2: Packet[] = [];
      const errors: Error[] = [];
      Rx1.on('packet', (packet) => received1.push(packet));
      Rx2.on('packet', (packet) => received2.push(packet));

      collectErrors(Rx1, errors);
      collectErrors(Rx2, errors);

      // stuff takes time
      await sleep(3500);
      await Tx1.send({ payload: { 11: 0xff } });
      await Tx2.send({ payload: { 22: 0xff } });
      await sleep(3500);

      assert.strictEqual(errors.length, 0);
      assert.strictEqual(received1.length, 1);
      assert.strictEqual(received2.length, 1);
      assert.deepStrictEqual(received1[0]!.payload, { 11: 100 });
      assert.deepStrictEqual(received2[0]!.payload, { 22: 100 });
    } finally {
      Tx1.close();
      Tx2.close();
      Rx1.close();
      Rx2.close();
    }
  });
});

describe('Sending to a unicast address', () => {
  it('can send data to a specific unicast address', async () => {
    const Tx = new Sender({
      universe: 51,
      useUnicastDestination: '127.0.0.1',
    });
    const Rx = new Receiver({ universes: [51] });
    try {
      const received: Packet[] = [];
      const errors: Error[] = [];
      Rx.on('packet', (packet) => received.push(packet));

      collectErrors(Rx, errors);

      // stuff takes time
      await sleep(3500);
      await Tx.send({ payload: { 22: 0xff } });
      await sleep(3500);

      assert.strictEqual(errors.length, 0);
      assert.strictEqual(received.length, 1);
      assert.deepStrictEqual(received[0]!.payload, { 22: 100 });
    } finally {
      Tx.close();
      Rx.close();
    }
  });

  it('receives nothing when sending data to an invalid unicast address', async () => {
    const Tx = new Sender({
      universe: 51,
      useUnicastDestination: '192.0.2.0', // https://en.wikipedia.org/wiki/Reserved_IP_addresses
    });
    const Rx = new Receiver({ universes: [51] });
    try {
      const received: Packet[] = [];
      const errors: Error[] = [];
      Rx.on('packet', (packet) => received.push(packet));

      collectErrors(Rx, errors);

      // stuff takes time
      await sleep(3500);
      await Tx.send({ payload: { 22: 0xff } });
      await sleep(3500);

      assert.strictEqual(errors.length, 0);
      assert.strictEqual(received.length, 0); // nothing was recevied
    } finally {
      Tx.close();
      Rx.close();
    }
  });
});
