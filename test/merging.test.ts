import { type Options, Packet } from '../src/packet';
import { MergingReceiver } from '../src/merging';
import type { Payload } from '../src/util';

/** helper function to make it easier to create the Map */
function createPackets(
  latestPackets: Record<
    string,
    Omit<Options, 'sequence' | 'universe'> & { timestamp?: number }
  >,
) {
  const latestPacketsMap = new Map<string, MergingReceiver.PacketWithTime>();
  for (const server in latestPackets) {
    const { timestamp = NaN, ...options } = latestPackets[server]!;
    latestPacketsMap.set(server, {
      packet: new Packet({ ...options, universe: 14, sequence: NaN }),
      timestamp,
    });
  }
  return latestPacketsMap;
}

function deleteZeros(payload: Payload) {
  for (const ch in payload) {
    if (!payload[ch]) delete payload[ch];
  }
}

describe('HTP', () => {
  it('2 receivers, different priority', () => {
    const merged = MergingReceiver.HTP({
      maximumPriority: 124,
      universe: 14,
      universeData: {
        referenceData: [NaN, 1, 2, 3, 4, 5],
        servers: createPackets({
          'main console': { priority: 124, payload: [NaN, 101, 102, 103] },
          'backup console': {
            priority: 123,
            payload: [NaN, 201, 202, 203, 204],
          },
        }),
      },
    });
    deleteZeros(merged);

    expect(merged).toStrictEqual({
      // HTP applies to the whole packet, so channel 4 is 0, instead of 204
      // referenceData is irrelevant for HTP, so channel 5 is 0, instead of 5
      1: 101,
      2: 102,
      3: 103,
    });
  });

  it('2 receivers, same priority', () => {
    const merged = MergingReceiver.HTP({
      maximumPriority: 123,
      universe: 14,
      universeData: {
        referenceData: [NaN, 1, 2, 3, 4, 5],
        servers: createPackets({
          'main console': { priority: 123, payload: [NaN, 101, 102, 103] },
          'backup console': {
            priority: 123,
            payload: [NaN, 201, 202, 0, 204],
          },
        }),
      },
    });
    deleteZeros(merged);

    expect(merged).toStrictEqual({
      1: 201,
      2: 202,
      3: 103, // main console has a higher value
      4: 204,
    });
  });
});

describe('LTP', () => {
  it('2 receivers, different priority', () => {
    const merged = MergingReceiver.LTP({
      maximumPriority: 124,
      universe: 14,
      universeData: {
        referenceData: [NaN, 1, 2, 3, 4, 5],
        servers: createPackets({
          'main console': {
            priority: 124,
            payload: [NaN, 101, 102, 103],
            timestamp: 1241,
          },
          'backup console': {
            priority: 123,
            payload: [NaN, 201, 202, 203, 204],
            timestamp: 1242, // newer packet but lower pirority
          },
        }),
      },
    });
    deleteZeros(merged);

    // LTP applies per-universe only, so it just picked the
    // packet with the highest priority
    // eslint-disable-next-line no-sparse-arrays
    expect(merged).toStrictEqual([, 101, 102, 103]);
  });

  it('2 receivers, same priority', () => {
    const merged = MergingReceiver.LTP({
      maximumPriority: 123,
      universe: 14,
      universeData: {
        referenceData: [NaN, 1, 2, 3, 4, 5],
        servers: createPackets({
          'main console': {
            priority: 123,
            payload: [NaN, 101, 102, 103],
            timestamp: 1241,
          },
          'backup console': {
            priority: 123,
            payload: [NaN, 201, 202, 203, 204],
            timestamp: 1242,
          },
        }),
      },
    });
    deleteZeros(merged);

    // LTP applies per-universe only, so it just picked the
    // packet with the latest timestamp
    // eslint-disable-next-line no-sparse-arrays
    expect(merged).toStrictEqual([, 201, 202, 203, 204]);
  });
});
