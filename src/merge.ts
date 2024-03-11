import { AssertionError } from 'assert';
import { Packet } from './packet';
import { Receiver } from './receiver';
import type { Payload } from './util';

interface MergeProps {
  universes?: number[];
  port?: number;
  iface?: string;
  reuseAddr?: boolean;
  timeout?: number;
}

interface Universe {
  lastData: Payload;
  servers: Map<string, SendersData>;
}

interface SendersData {
  readonly cid: string;
  readonly data: Payload;
  readonly priority: number;
  readonly sequence: number;
  readonly universe: number;
  readonly lastTimestamp: number;
}

export class ReceiverMerge extends Receiver {
  constructor({ timeout = 5000, ...props }: MergeProps) {
    super(props);
    this.timeout = timeout;
    super.on('packet', this.mergePacket);
  }

  readonly timeout: number;

  protected data = new Map<string, Universe>();

  mergePacket(packet: Packet) {
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
      cid: packet.cid.toString(),
      data: packet.payload,
      priority: packet.priority,
      sequence: packet.sequence,
      universe: packet.universe,
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
    let maximumPrio = 0;
    for (const [, data] of universeData.servers) {
      if (data.priority > maximumPrio && data.universe === packet.universe) {
        maximumPrio = data.priority;
      }
    }

    // HTP
    const mergedData: Payload = {};
    for (const [, data] of universeData.servers) {
      if (data.priority === maximumPrio && data.universe === packet.universe) {
        for (let i = 1; i <= 512; i += 1) {
          const newValue = data.data[i] || 0;
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

  clearCache() {
    // causes every addr value to be emitted
    for (const [, univese] of this.data) {
      univese.lastData = {};
    }
  }
}
export declare interface ReceiverMerge {
  // on(event: string, listener: (...args: any[]) => void): this;
  on(
    event: Parameters<Receiver['on']>[0],
    listener: Parameters<Receiver['on']>[1],
  ): this;
  on(
    event: 'changed',
    listener: (ev: {
      universe: number;
      addr: number;
      newValue: number;
      oldValue: number;
    }) => void,
  ): this;
  on(event: 'changesDone', listener: () => void): this;
  on(
    event: 'senderConnect',
    listener: (ev: {
      cid: number;
      universe: number;
      firstPacket: Packet;
    }) => void,
  ): this;
  on(
    event: 'senderDisconnect',
    listener: (ev: {
      cid: number;
      universe: number;
      lastPacket: Packet;
    }) => void,
  ): this;
  on(event: 'packet', listener: (packet: Packet) => void): this;
  on(event: 'PacketCorruption', listener: (err: AssertionError) => void): this;
  on(event: 'PacketOutOfOrder', listener: (err: Error) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
}
