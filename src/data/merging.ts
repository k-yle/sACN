import { DMXUniverse } from './universe';
import { Packet } from '../packet';

export interface SenderData {
  readonly cid: string;
  readonly priority: number;
  readonly universe: number;
  readonly data: DMXUniverse;
  readonly lastUpdate: number;
  readonly sequence: number;
}

export interface UniverseData {
  referenceData: DMXUniverse;
  servers: Map<string, SenderData>;
}

export interface PreparedData {
  universe: number;
  maximumPriority: number;
  universeData: UniverseData;
}

export interface ProcessedData extends PreparedData {
  mergedData: DMXUniverse;
}

export interface MergingReceiverChannelChanged {
  universe: number;
  address: number;
  newValue: number;
  oldValue: number;
}

export interface MergingReceiverUniverseChanged {
  universe: number;
  payload: number[];
}

export interface MergingReceiverSenderConnect {
  cid: number;
  universe: number;
  firstPacket: Packet;
}

export interface MergingReceiverSenderDisconnect {
  cid: number;
  universe: number;
  lastPacket: Packet;
}
