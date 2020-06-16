import { Socket, createSocket } from 'dgram';
import { multicastGroup } from './util';
import { Packet, Options } from './packet';

interface Props {
  universe: number;
  port?: number;
  reuseAddr?: boolean;
}

export class Sender {
  private socket: Socket;

  private readonly port: Props['port'];

  public readonly universe: Props['universe'];

  private readonly multicastDest: string;

  private sequence = 0;

  constructor({ universe, port = 5568, reuseAddr = false }: Props) {
    this.port = port;
    this.universe = universe;
    this.multicastDest = multicastGroup(universe);

    this.socket = createSocket({ type: 'udp4', reuseAddr });
  }

  public send(packet: Omit<Options, 'sequence' | 'universe'>): Promise<void> {
    return new Promise((resolve, reject) => {
      const { buffer } = new Packet({
        ...packet,
        universe: this.universe,
        sequence: this.sequence,
      });
      this.sequence = (this.sequence + 1) % 256;
      this.socket.send(buffer, this.port, this.multicastDest, (err) =>
        err ? reject(err) : resolve(),
      );
    });
  }

  public close(): this {
    this.socket.close();
    return this;
  }
}
