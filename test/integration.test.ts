import * as assert from 'assert';
import { createSocket } from 'dgram';

import { Receiver, objectify, multicastGroup, Packet } from '../src';
import { buff } from './validBuffer';

const sleep = (ms: number) => new Promise((cb) => setTimeout(cb, ms));

async function createSocketAndSend() {
  return new Promise((resolve, reject) => {
    const client = createSocket('udp4');

    // send something to universe 1 and 3
    client.send(buff, 5568, multicastGroup(3));
    client.send(buff, 5568, multicastGroup(1), (err) => {
      client.close();
      return err ? reject(err) : resolve();
    });
  });
}

describe('Receiver', () => {
  it("receives packets on the universes it's meant to listen on", async () => {
    const received: Packet[] = [];
    const sACN = new Receiver({
      universes: [1, 2], // not listening to universe 3
    });
    sACN.on('packet', (packet) => received.push(packet));
    sACN.on('PacketCorruption', console.error);
    sACN.on('PacketOutOfOrder', console.error);

    // stuff takes time
    await sleep(3500);
    await createSocketAndSend();
    await sleep(3500);

    assert.equal(received.length, 1);
    assert.deepEqual(objectify(received[0].slotsData), {
      1: 92,
      2: 100,
      4: 100,
    });

    sACN.close();
  });
  it('throws a catchable error when an invalid interface is supplied', async () => {
    const errors: Error[] = [];
    const sACN = new Receiver({
      universes: [1],
      iface: '/dev/null',
    });
    sACN.on('error', (ex) => errors.push(ex));

    // stuff takes time
    await sleep(500);

    assert.equal(errors.length, 1);
    assert.equal(errors[0].message, 'addMembership EINVAL');

    sACN.close();
  });
  it('has working addUniverse and removeUniverse methods', async () => {
    const sACN = new Receiver({
      universes: [1, 2, 500],
    });
    await sleep(500);
    assert.deepEqual(sACN.universes, [1, 2, 500]);

    sACN.addUniverse(4);
    await sleep(500);
    assert.deepEqual(sACN.universes, [1, 2, 500, 4]);

    sACN.addUniverse(4); // making sure there's no error re-adding something
    await sleep(500);
    assert.deepEqual(sACN.universes, [1, 2, 500, 4]);

    sACN.removeUniverse(500);
    await sleep(500);
    assert.deepEqual(sACN.universes, [1, 2, 4]);

    sACN.removeUniverse(123); // making sure there's no error deleting something non-existant
    await sleep(500);
    assert.deepEqual(sACN.universes, [1, 2, 4]);

    sACN.close();
  });
});
