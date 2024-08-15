import { type Socket, createSocket } from 'dgram';
import { EventEmitter } from 'events';
import { AssertionError } from 'assert';

import { Packet } from './packet';
import { multicastGroup } from './util';

/** @deprecated - use {@link Receiver.Props} instead */
export type ReceiverProps = Receiver.Props;

export declare namespace Receiver {
  export interface Props {
    /** List of universes to listen to. Must be within `1-63999 */
    universes?: number[];
    /** The multicast port to use. All professional consoles broadcast to the default port. */
    port?: number;
    /** local ip address of network inteface to use */
    iface?: string;
    /** Allow multiple programs on your computer to listen to the same sACN universe. */
    reuseAddr?: boolean;
  }

  export interface EventMap {
    packet: Packet;
    PacketCorruption: AssertionError;
    PacketOutOfOrder: Error;
    error: Error;
  }
}

export declare interface Receiver {
  on<K extends keyof Receiver.EventMap>(
    type: K,
    listener: (event: Receiver.EventMap[K]) => void,
  ): this;
}

export class Receiver extends EventEmitter {
  private socket: Socket;

  private lastSequence: Record<string, number>;

  private readonly port: Receiver.Props['port'];

  public universes: NonNullable<Receiver.Props['universes']>;

  private readonly iface: Receiver.Props['iface'];

  constructor({
    universes = [1],
    port = 5568,
    iface = undefined,
    reuseAddr = false,
  }: Receiver.Props) {
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

        // we keep track of the last sequence per sender and per universe (see #37)
        const key = packet.cid.toString('utf8') + packet.universe;

        const outOfOrder =
          this.lastSequence[key] &&
          Math.abs(this.lastSequence[key]! - packet.sequence) > 20;

        const oldSequence = this.lastSequence[key];
        this.lastSequence[key] = packet.sequence === 255 ? -1 : packet.sequence;

        if (outOfOrder) {
          throw new Error(
            `Packet significantly out of order in universe ${packet.universe} from ${packet.sourceName} (${oldSequence} -> ${packet.sequence})`,
          );
        }

        this.emit('packet', packet);
      } catch (err) {
        const event =
          err instanceof AssertionError
            ? 'PacketCorruption'
            : 'PacketOutOfOrder';
        this.emit(event, err);
      }
    });
    this.socket.on('error', (ex) => this.emit('error', ex));
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
