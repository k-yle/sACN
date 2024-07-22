import { performance } from 'node:perf_hooks';
import { Packet } from '../packet';
import { Receiver } from '../receiver';
import type { Payload } from '../util';

interface Universe {
  lastData: Payload;
  servers: Map<string, PacketWithTimestamp>;
}

interface PacketWithTimestamp {
  readonly packet: Packet;
  readonly lastTimestamp: number;
}

export namespace ReceiverMerge {
  export interface Props extends Receiver.Props {
    timeout?: number;
  }

  export interface EventMap extends Receiver.EventMap {
    changed: {
      universe: number;
      addr: number;
      newValue: number;
      oldValue: number;
    };
    changesDone: never;
    senderConnect: {
      cid: number;
      universe: number;
      firstPacket: Packet;
    };
    senderDisconnect: {
      cid: number;
      universe: number;
      lastPacket: Packet;
    };
  }
}

export declare interface ReceiverMerge {
  on<K extends keyof Receiver.EventMap>(
    type: K,
    listener: (event: Receiver.EventMap[K]) => void,
  ): this;
}

export class ReceiverMerge extends Receiver {
  constructor({ timeout = 5000, ...props }: ReceiverMerge.Props) {
    super(props);
    this.timeout = timeout;
    super.on('packet', this.mergePacket);
  }

  readonly timeout: number;

  protected data = new Map<string, Universe>();

  public mergePacket(packet: Packet) {
    const universe = packet.universe.toString(36);
    const cid = packet.cid.toString();

    if (!this.data.has(universe)) {
      this.data.set(universe, {
        lastData: [],
        servers: new Map(),
      });
      this.emit('newUniverse', {
        universe: packet.universe,
        firstPacket: packet,
      });
    }

    const universeData = this.data.get(universe);

    if (!universeData) {
      throw new Error('[sACN] Internal Error: universeData is undefined');
    }

    if (!universeData.servers.has(cid)) {
      this.emit('senderConnect', {
        cid: packet.cid,
        universe: packet.universe,
        firstPacket: packet,
      });
    }

    const ts = performance.now();

    universeData.servers.set(cid, {
      packet,
      lastTimestamp: ts,
    });

    setTimeout(() => {
      if (universeData.servers.get(cid)?.lastTimestamp === ts) {
        universeData.servers.delete(cid);
        this.emit('senderDisconnect', {
          cid: packet.cid,
          universe: packet.universe,
          lastPacket: packet,
        });
      }
    }, this.timeout);

    // detect which source has the highest per-universe priority
    let maximumPriority = 0;
    for (const [, { packet: thisPacket }] of universeData.servers) {
      if (
        thisPacket.priority > maximumPriority &&
        thisPacket.universe === packet.universe
      ) {
        maximumPriority = thisPacket.priority;
      }
    }

    // HTP
    const mergedData: Payload = {};
    for (const [, { packet: thisPacket }] of universeData.servers) {
      if (
        thisPacket.priority === maximumPriority &&
        thisPacket.universe === packet.universe
      ) {
        for (let i = 1; i <= 512; i += 1) {
          const newValue = thisPacket.payload[i] || 0;
          if ((mergedData[i] ?? 0) < newValue) {
            mergedData[i] = newValue;
          }
        }
      }
    }

    // only changes
    for (let i = 1; i <= 512; i += 1) {
      if (universeData.lastData[i] !== mergedData[i]) {
        super.emit('changed', {
          universe: packet.universe,
          addr: i,
          newValue: mergedData[i],
          oldValue: universeData.lastData[i],
        });
      }
      universeData.lastData[i] = mergedData[i] || 0;
    }
    super.emit('changesDone');
  }

  public clearCache() {
    // causes every addr value to be emitted
    for (const [, univese] of this.data) {
      univese.lastData = {};
    }
  }
}
