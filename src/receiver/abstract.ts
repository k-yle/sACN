import { AssertionError } from 'assert';
import { Receiver, ReceiverProps } from '../receiver';
import { DMXUniverse } from '../data/universe';
import { Packet } from '../packet';
import {
  MergingReceiverChannelChanged,
  MergingReceiverSenderConnect,
  MergingReceiverSenderDisconnect,
  MergingReceiverUniverseChanged,
  PreparedData,
  ProcessedData,
  UniverseData,
} from '../data/merging';

export interface MergingReceiverProps extends ReceiverProps {
  universes?: number[];
  port?: number;
  iface?: string;
  reuseAddr?: boolean;
  timeout?: number;
}

export abstract class AbstractMergingReceiver extends Receiver {
  protected readonly timeout: number;

  protected data = new Map<number, UniverseData>();

  constructor({ timeout = 5000, ...props }: MergingReceiverProps) {
    super(props);

    this.timeout = timeout;

    super.on('packet', (packet) => {
      const data = this.prepareData(packet);
      const mergedData = this.mergeData(data);
      if (mergedData !== null) {
        this.handleChanges({
          ...data,
          mergedData,
        });
      }
    });
  }

  protected prepareData(packet: Packet): PreparedData {
    const currentTime = performance.now();
    const universe = parseInt(packet.universe.toString(36), 10);
    const cid = packet.cid.toString();

    // universe is unknown
    if (!this.data.has(universe)) {
      this.data.set(universe, {
        referenceData: new DMXUniverse(),
        servers: new Map(),
      });

      this.emit('newUniverse', {
        universe,
        firstPacket: packet,
      });
    }

    const universeData: UniverseData = this.data.get(universe) as UniverseData;
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
      cid: packet.cid.toString(),
      priority: packet.priority,
      universe,
      data: new DMXUniverse(packet.payload),
      lastUpdate: currentTime,
      sequence: packet.sequence,
    });

    // check whether sender disconnects
    setTimeout(() => {
      if (universeData.servers.get(cid)?.lastUpdate === currentTime) {
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
    for (const [, data] of universeData.servers) {
      if (
        data.priority > maximumPriority &&
        data.universe === packet.universe
      ) {
        maximumPriority = data.priority;
      }
    }

    return {
      universe,
      maximumPriority,
      universeData,
    };
  }

  protected abstract mergeData(packet: PreparedData): DMXUniverse | null;

  protected handleChanges(data: ProcessedData): void {
    const { referenceData } = data.universeData;
    const { mergedData } = data;

    // only changes
    let changesDetected = false;
    for (let ch = 0; ch < 512; ch += 1) {
      if (referenceData.data[ch] !== mergedData.data[ch]) {
        changesDetected = true;

        super.emit('changedValue', {
          universe: data.universe,
          address: ch + 1,
          newValue: mergedData.data[ch],
          oldValue: referenceData.data[ch],
        } as MergingReceiverChannelChanged);
      }
    }

    if (changesDetected) {
      this.data.get(data.universe)!.referenceData = mergedData;

      super.emit('changed', {
        universe: data.universe,
        payload: mergedData.data,
      } as MergingReceiverUniverseChanged);
    }
  }
}

export declare interface AbstractMergingReceiver {
  on(
    event: Parameters<Receiver['on']>[0],
    listener: Parameters<Receiver['on']>[1],
  ): this;
  on(
    event: 'changedValue',
    listener: (ev: MergingReceiverChannelChanged) => void,
  ): this;
  on(
    event: 'changed',
    listener: (ev: MergingReceiverUniverseChanged) => void,
  ): this;
  on(
    event: 'senderConnect',
    listener: (ev: MergingReceiverSenderConnect) => void,
  ): this;
  on(
    event: 'senderDisconnect',
    listener: (ev: MergingReceiverSenderDisconnect) => void,
  ): this;
  on(event: 'packet', listener: (packet: Packet) => void): this;
  on(event: 'PacketCorruption', listener: (err: AssertionError) => void): this;
  on(event: 'PacketOutOfOrder', listener: (err: Error) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
}
