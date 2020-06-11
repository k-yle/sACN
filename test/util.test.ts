/* global describe, it */
import * as assert from 'assert';

import { objectify, multicastGroup } from '../src/util';

describe('objectify', () => {
  describe('buffer 1', () => {
    const obj = objectify(Buffer.from([255, 0, 255]));
    it('should equal ', () =>
      assert.deepEqual(obj, {
        1: 100,
        3: 100,
      }));
  });
  describe('buffer 2', () => {
    const obj = objectify(
      Buffer.from(
        '110 121 255 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 100 0 0 172 0 0 1 114 11 2 161 0 0 0 1 2 1 0 234 255 0 255 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 255'
          .split(' ')
          .map(Number),
      ),
    );
    it('should equal ', () =>
      assert.deepEqual(obj, {
        1: 43,
        2: 47,
        3: 100,
        64: 39,
        67: 67,
        70: 0,
        71: 45,
        72: 4,
        73: 1,
        74: 63,
        78: 0,
        79: 1,
        80: 0,
        82: 92,
        83: 100,
        85: 100,
        512: 100,
      }));
  });
});

describe('multicastGroup', () => {
  it('produces correct output for valid universes', () => {
    assert.equal(multicastGroup(1), '239.255.0.1');
    assert.equal(multicastGroup(2), '239.255.0.2');
    assert.equal(multicastGroup(255), '239.255.0.255');
    assert.equal(multicastGroup(63999), '239.255.249.255');
    assert.equal(multicastGroup(64214), '239.255.250.214');
    assert.equal(multicastGroup(256), '239.255.1.0');
  });
  it('throws an error for invalid universes', () => {
    assert.throws(() => multicastGroup(0));
    assert.throws(() => multicastGroup(64000));
    assert.throws(() => multicastGroup(NaN));
    assert.throws(() => multicastGroup(Infinity));
  });
});
