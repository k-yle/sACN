import * as assert from 'assert';

import { Packet } from '../src/packet';
import { objectify } from '../src/index';
import { buff } from './validBuffer';

describe('Simple Packet', () => {
  const packet = new Packet(buff, '10.0.225.7');

  describe('Metadata', () => {
    it('correct universe', () => assert.equal(packet.universe, 1));
    it('correct sourceName', () => assert.equal(packet.sourceName, 'Onyx'));
    it('correct sequence', () => assert.equal(packet.sequence, 172));
    it('correct sourceAddress', () =>
      assert.equal(packet.sourceAddress, '10.0.225.7'));
    it('correct priority', () => assert.equal(packet.priority, 100));
    it('correct dmx data', () =>
      assert.deepEqual(objectify(packet.slotsData), { 1: 92, 2: 100, 4: 100 }));
  });
});
