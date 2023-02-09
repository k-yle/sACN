import { AssertionError } from 'assert';
import { Packet } from './packet';
import { Receiver } from './receiver';
import { SACNData } from './sACNData';

interface MergeProps {
  universes?: number[];
  port?: number;
  iface?: string;
  reuseAddr?: boolean;
  timeout?: number;
}

interface Universe {
  lastData: SACNData;
  servers: Map<string, SendersData>;
}

interface SendersData {
  readonly cid: string;
  readonly data: SACNData;
  readonly prio: number;
  readonly seq: number;
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
        lastData: new SACNData(),
        servers: new Map(),
      });
      this.emit('newUniverse', {
        universe: packet.universe,
        firstPacket: packet,
      });
    }

    const universeData: Universe = this.data.get(universe) as Universe;

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
      data: new SACNData(packet.payload),
      prio: packet.priority,
      seq: packet.sequence,
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
      if (data.prio > maximumPrio && data.universe === packet.universe) {
        maximumPrio = data.prio;
      }
    }

    // HTP
    const mergedData = new SACNData();
    for (const [, data] of universeData.servers) {
      if (data.prio === maximumPrio && data.universe === packet.universe) {
        let i = 0;
        while (i < 512) {
          const newValue = data.data.data[i] || 0;
          if ((mergedData.data[i] ?? 0) < newValue) {
            mergedData.data[i] = newValue;
          }
          i += 1;
        }
      }
    }

    // only changes
    let i = 0;
    while (i < 512) {
      if (universeData.lastData.data[i] !== mergedData.data[i]) {
        super.emit('changed', {
          universe: packet.universe,
          addr: i + 1,
          newValue: mergedData.data[i],
          oldValue: universeData.lastData.data[i],
        });
      }
      universeData.lastData.data[i] = mergedData.data[i] || 0;
      i += 1;
    }
    super.emit('changesDone');
  }

  clearCache() {
    // causes every addr value to be emitted
    for (const [, univese] of this.data) {
      univese.lastData = new SACNData();
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
