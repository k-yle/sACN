import * as dgram from 'dgram';
import { EventEmitter } from 'events';
import { AssertionError } from 'assert';

import Packet from './packet';

function multicastGroup(universe: number): string {
  if (universe < 1 || universe > 63999) throw new RangeError('universe must be between 1-63999');
  // eslint-disable-next-line no-bitwise
  return `239.255.${universe >> 8}.${universe & 255}`;
}

export function objectify(buf: Buffer): Record<string, number> {
  const data = {};
  buf.forEach((val, ch) => {
    if (val > 0) data[ch + 1] = Math.round(val / 2.55);
  });
  return data;
}

export class Receiver extends EventEmitter {
  private socket: dgram.Socket;

  private lastSequence: Record<string, number>;

  private port: number;

  private universes: number[];

  private iface: string|null; // local ip address of network inteface to use

  constructor({
    universes = [1], port = 5568, iface = undefined, reuseAddr = false,
  }) {
    super();
    this.universes = universes;
    this.port = port;
    this.iface = iface;

    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr });
    this.lastSequence = {};

    // for (const uni of universes) this.lastSequence[uni] = 0;

    this.socket.on('message', (msg, rinfo) => {
      try {
        const packet = new Packet(msg, rinfo.address);
        if (this.lastSequence[packet.universe] && Math.abs(this.lastSequence[packet.universe] - packet.sequence) > 20) {
          throw new Error(`Packet significantly out of order in universe ${packet.universe} (${this.lastSequence[packet.universe]} -> ${packet.sequence})`);
        }
        this.lastSequence[packet.universe] = packet.sequence === 255 ? -1 : packet.sequence;
        this.emit('packet', packet);
      } catch (err) {
        const event = err instanceof AssertionError ? 'PacketCorruption' : 'PacketOutOfOrder';
        this.emit(event, err);
      }
    });
    this.socket.bind(this.port, () => {
      for (const uni of this.universes) {
        if (uni > 63999 && uni !== 64214) throw new Error('Universe must be within 0-63999');
        this.socket.addMembership(multicastGroup(uni), this.iface);
      }
    });
  }

  close(): void {
    this.socket.close();
  }
}
