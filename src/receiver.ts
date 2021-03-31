import { Socket, createSocket } from 'dgram';
import { EventEmitter } from 'events';
import { AssertionError } from 'assert';

import { Packet } from './packet';
import { multicastGroup } from './util';

interface Props {
  universes?: number[];
  port?: number;
  iface?: string; // local ip address of network inteface to use
  reuseAddr?: boolean;
}

export declare interface Receiver {
  on(event: 'packet', listener: (packet: Packet) => void): this;
  on(event: 'PacketCorruption', listener: (err: AssertionError) => void): this;
  on(event: 'PacketOutOfOrder', listener: (err: Error) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
}

export class Receiver extends EventEmitter {
  private socket: Socket;

  private lastSequence: Record<string, number>;

  private readonly port: Props['port'];

  public universes: NonNullable<Props['universes']>;

  private readonly iface: Props['iface'];

  constructor({
    universes = [1],
    port = 5568,
    iface = undefined,
    reuseAddr = false,
  }: Props) {
    super();
    this.universes = universes;
    this.port = port;
    this.iface = iface;

    this.socket = createSocket({ type: 'udp4', reuseAddr });
    this.lastSequence = {};

    this.socket.on('message', (msg, rinfo) => {
      try {
        const packet = new Packet(msg, rinfo.address);

        // somehow we received a packet for a universe we're not listening to
        // silently drop this packet
        if (!this.universes.includes(packet.universe)) return;

        if (
          this.lastSequence[packet.universe] &&
          Math.abs(this.lastSequence[packet.universe]! - packet.sequence) > 20
        ) {
          throw new Error(
            `Packet significantly out of order in universe ${
              packet.universe
            } (${this.lastSequence[packet.universe]} -> ${packet.sequence})`,
          );
        }
        this.lastSequence[packet.universe] =
          packet.sequence === 255 ? -1 : packet.sequence;
        this.emit('packet', packet);
      } catch (err) {
        const event =
          err instanceof AssertionError
            ? 'PacketCorruption'
            : 'PacketOutOfOrder';
        this.emit(event, err);
      }
    });
    this.socket.bind(this.port, () => {
      for (const uni of this.universes) {
        try {
          this.socket.addMembership(multicastGroup(uni), this.iface);
        } catch (err) {
          this.emit('error', err); // emit errors from socket.addMembership
        }
      }
    });
  }

  public addUniverse(universe: number): this {
    // already listening to this one; do nothing
    if (this.universes.includes(universe)) return this;

    this.socket.addMembership(multicastGroup(universe), this.iface);
    this.universes.push(universe);
    return this;
  }

  public removeUniverse(universe: number): this {
    // not listening to this one; do nothing
    if (!this.universes.includes(universe)) return this;

    this.socket.dropMembership(multicastGroup(universe), this.iface);
    this.universes = this.universes.filter((n) => n !== universe);
    return this;
  }

  public close(callback?: () => void): this {
    this.socket.close(callback);
    return this;
  }
}
