import { performance } from 'perf_hooks';
import type { Packet } from './packet';
import { Receiver } from './receiver';
import type { Payload } from './util';

/**
 * @deprecated CAUTION: This feature is experimental,
 * and has not been thoroughly tested. It may not behave
 * correctly. There is no guarantee that it adheres to
 * the E1.33 standard.
 */
export namespace MergingReceiver {
  /** See {@link Props.mode here} for docs */
  export type Mode = 'HTP' | 'LTP';

  export interface Props extends Receiver.Props {
    /**
     * ### Different priority
     * .
     * When merging, all senders should normally have a different
     * `priority`. Following this rule will prevent most of the
     * confusion around merging.
     *
     * 💡 _Use case: tracking-backup console._
     *
     * ### Same priority
     * .
     * If there are 2 senders with the same `priority`,
     * then you need to specify the merging mode:
     *
     * - `HTP` = **H**ighest **t**akes **P**riority. This means
     * that the receiver will use the highest channel value from
     * all senders with the same `priority`. If there is a
     * malfunction, channels may appear to be stuck, even when
     * blacked-out on one console.
     * 💡 _Use case: {@link https://youtu.be/vygFW9FDYtM parking a channel}
     * or controlling {@link https://en.wiktionary.org/wiki/houselights houselights}
     * from a different console._
     *
     * - `LTP` = **L**atest **t**akes **P**riority. This means that
     * the receiver will use the latest data that it receives from
     * the senders with the highest `priority`. **This options is
     * not recomended, because a malfunction will cause of lights
     * to flicker uncontrollably.**
     * 💡 _Use case: none._
     *
     * ℹ️ Please refer to the README for more information.
     *
     * @default 'HTP'
     */
    mode?: Mode;
    timeout?: number;
  }

  export interface EventMap extends Receiver.EventMap {
    changed: {
      universe: number;
      payload: Payload;
    };
    changedValue: {
      universe: number;
      address: number;
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

  export interface PacketWithTime {
    readonly packet: Packet;
    readonly timestamp: number;
  }

  export interface UniverseData {
    referenceData: Payload;
    servers: Map<string, PacketWithTime>;
  }

  export interface PreparedData {
    universe: number;
    maximumPriority: number;
    universeData: UniverseData;
  }
}

export declare interface MergingReceiver {
  on<K extends keyof MergingReceiver.EventMap>(
    type: K,
    listener: (event: MergingReceiver.EventMap[K]) => void,
  ): this;
}

export class MergingReceiver extends Receiver {
  private readonly mode: MergingReceiver.Mode;

  private readonly timeout: number;

  private data = new Map<number, MergingReceiver.UniverseData>();

  constructor({
    mode = 'HTP',
    timeout = 5000,
    ...props
  }: MergingReceiver.Props) {
    super(props);

    this.mode = mode;
    this.timeout = timeout;

    super.on('packet', (packet) => {
      const data = this.prepareData(packet);
      const mergedData = MergingReceiver[this.mode](data);
      this.handleChanges(data, mergedData);
    });
  }

  private prepareData(packet: Packet): MergingReceiver.PreparedData {
    const currentTime = performance.now();
    const universe = parseInt(packet.universe.toString(36), 10);
    const cid = packet.cid.toString();

    // universe is unknown
    if (!this.data.has(universe)) {
      this.data.set(universe, {
        referenceData: {},
        servers: new Map(),
      });

      this.emit('newUniverse', {
        universe,
        firstPacket: packet,
      });
    }

    const universeData = this.data.get(universe);
    if (!universeData) {
      throw new Error('[sACN] Internal Error: universeData is undefined');
    }

    // sender is unknown for this universe
    if (!universeData.servers.has(cid)) {
      this.emit('senderConnect', {
        cid: packet.cid,
        universe,
        firstPacket: packet,
      });
    }

    // register current package
    universeData.servers.set(cid, {
      packet,
      timestamp: currentTime,
    });

    // check whether sender disconnects
    setTimeout(() => {
      if (universeData.servers.get(cid)?.timestamp === currentTime) {
        universeData.servers.delete(cid);

        this.emit('senderDisconnect', {
          cid: packet.cid,
          universe,
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

    return {
      universe,
      maximumPriority,
      universeData,
    };
  }

  private handleChanges(
    data: MergingReceiver.PreparedData,
    mergedData: Payload,
  ): void {
    const { referenceData } = data.universeData;

    // only changes
    let changesDetected = false;
    for (let ch = 1; ch <= 512; ch += 1) {
      if (referenceData[ch] !== mergedData[ch]) {
        changesDetected = true;

        const event: MergingReceiver.EventMap['changedValue'] = {
          universe: data.universe,
          address: ch,
          newValue: mergedData[ch]!,
          oldValue: referenceData[ch]!,
        };
        super.emit('changedValue', event);
      }
    }

    if (changesDetected) {
      this.data.get(data.universe)!.referenceData = mergedData;

      const event: MergingReceiver.EventMap['changed'] = {
        universe: data.universe,
        payload: mergedData,
      };
      super.emit('changed', event);
    }
  }

  public static HTP(data: MergingReceiver.PreparedData): Payload {
    const mergedData: Payload = {};

    for (const [, { packet }] of data.universeData.servers) {
      if (
        packet.priority === data.maximumPriority &&
        packet.universe === data.universe
      ) {
        for (let ch = 1; ch <= 512; ch += 1) {
          const newValue = packet.payload[ch] || 0;
          if ((mergedData[ch] ?? 0) <= newValue) {
            mergedData[ch] = newValue;
          }
        }
      }
    }

    return mergedData;
  }

  /**
   * LTP can only operate per-universe, not per-channel. There is no
   * situation where LTP-per-channel would be useful.
   *
   * Therefore, this function just returns the packet with the highest
   * priority and the latest timestamp.
   */
  public static LTP(data: MergingReceiver.PreparedData): Payload {
    let maximumTimestamp = -Infinity;
    for (const [, { packet, timestamp }] of data.universeData.servers) {
      if (
        packet.priority === data.maximumPriority &&
        packet.universe === data.universe &&
        timestamp > maximumTimestamp
      ) {
        maximumTimestamp = timestamp;
      }
    }

    for (const [, { packet, timestamp }] of data.universeData.servers) {
      if (
        packet.priority === data.maximumPriority &&
        packet.universe === data.universe &&
        timestamp === maximumTimestamp
      ) {
        return packet.payload;
      }
    }

    throw new Error('Internal error');
  }
}
