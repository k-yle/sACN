/* global describe, it */
import * as assert from 'assert';

import { Receiver } from '../src/index';

const sleep = (ms: number): Promise<void> => new Promise((cb): NodeJS.Timeout => setTimeout(cb, ms));

describe('Receiver', () => {
  it('can be instantiated', () => assert.doesNotReject(async () => {
    const sACN = new Receiver({
      // no defaults
    });
    await sleep(500);
    sACN.close();
  }));
});
