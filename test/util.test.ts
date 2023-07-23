/* global describe, it */
import assert from 'assert';

import {
  objectify,
  multicastGroup,
  inRange,
  bit,
  empty,
  dp,
} from '../src/util';

describe('objectify', () => {
  it('should produce unrounded percentages for buf1', () => {
    const obj = objectify(Buffer.from([255, 0, 255]));
    assert.deepStrictEqual(obj, {
      1: 100,
      3: 100,
    });
  });

  it('should produce unrounded percentages for buf2', () => {
    const obj = objectify(
      Buffer.from(
        '110 121 255 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 100 0 0 172 0 0 1 114 11 2 161 0 0 0 1 2 1 0 234 255 0 255 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 255'
          .split(' ')
          .map(Number),
      ),
    );
    assert.deepStrictEqual(obj, {
      1: 43.14,
      2: 47.45,
      3: 100,
      64: 39.22,
      67: 67.45,
      70: 0.39,
      71: 44.71,
      72: 4.31,
      73: 0.78,
      74: 63.14,
      78: 0.39,
      79: 0.78,
      80: 0.39,
      82: 91.76,
      83: 100,
      85: 100,
      512: 100,
    });
  });
});

describe('multicastGroup', () => {
  it('produces correct output for valid universes', () => {
    assert.deepStrictEqual(multicastGroup(1), '239.255.0.1');
    assert.deepStrictEqual(multicastGroup(2), '239.255.0.2');
    assert.deepStrictEqual(multicastGroup(255), '239.255.0.255');
    assert.deepStrictEqual(multicastGroup(63999), '239.255.249.255');
    assert.deepStrictEqual(multicastGroup(64214), '239.255.250.214');
    assert.deepStrictEqual(multicastGroup(256), '239.255.1.0');
  });

  it('throws an error for invalid universes', () => {
    assert.throws(() => multicastGroup(0));
    assert.throws(() => multicastGroup(64000));
    assert.throws(() => multicastGroup(NaN));
    assert.throws(() => multicastGroup(Infinity));
  });
});

describe('inRange', () => {
  it('rounds and limits to range', () => {
    assert.deepStrictEqual(inRange(0), 0);
    assert.deepStrictEqual(inRange(1), 1);
    assert.deepStrictEqual(inRange(-1), 0);
    assert.deepStrictEqual(inRange(-Infinity), 0);

    assert.deepStrictEqual(inRange(255), 255);
    assert.deepStrictEqual(inRange(256), 255);
    assert.deepStrictEqual(inRange(Infinity), 255);

    assert.deepStrictEqual(inRange(12.3), 12);
  });
});

describe('bit', () => {
  it('generates valid unsigned ints', () => {
    assert.deepStrictEqual(bit(8, 0x12), [0x12]);
    assert.deepStrictEqual(bit(16, 0x1234), [0x12, 0x34]);
    assert.deepStrictEqual(bit(24, 0x123456), [0x12, 0x34, 0x56]);
    assert.deepStrictEqual(bit(32, 0x12345678), [0x12, 0x34, 0x56, 0x78]);
  });
});

describe('empty', () => {
  it('works', () => {
    assert.deepStrictEqual(empty(4), [0, 0, 0, 0]);
  });
});

describe('dp', () => {
  it('rounds to the correct amount of decimal places', () => {
    assert.deepStrictEqual(dp(12.3459, 3), 12.346);
    assert.deepStrictEqual(dp(12.3411), 12.34);
  });
});
