import { Socket, createSocket } from 'dgram';
import { multicastGroup } from './util';
import { Packet, Options } from './packet';

interface Props {
  universe: number;
  port?: number;
  reuseAddr?: boolean;
  /**
   * How often the data should be re-sent (**in Hertz/Hz**), even if it hasn't changed.
   *
   * By default data will only be sent once (equivilant of setting `refreshRate: 0`).
   *
   * To re-send data 5 times per second (`5Hz`), set `refreshRate: 5`. This is equivilant to `200ms`.
   */
  minRefreshRate?: number;
}

export class Sender {
  private socket: Socket;

  private readonly port: Props['port'];

  public readonly universe: Props['universe'];

  private readonly multicastDest: string;

  private sequence = 0;

  #loopId: NodeJS.Timeout | undefined;

  /**
   * we keep track of the most recent value of every channel, so that we can
   * send it regulally if `refreshRate` != 0. `undefined` if nothing has been
   * sent yet.
   */
  #latestPacketOptions: Omit<Options, 'sequence' | 'universe'> | undefined;

  constructor({
    universe,
    port = 5568,
    reuseAddr = false,
    minRefreshRate = 0,
  }: Props) {
    this.port = port;
    this.universe = universe;
    this.multicastDest = multicastGroup(universe);

    this.socket = createSocket({ type: 'udp4', reuseAddr });

    if (minRefreshRate) {
      this.#loopId = setInterval(() => this.reSend(), 1000 / minRefreshRate);
    }
  }

  public send(packet: Omit<Options, 'sequence' | 'universe'>): Promise<void> {
    this.#latestPacketOptions = packet;
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

  private reSend() {
    if (this.#latestPacketOptions) this.send(this.#latestPacketOptions);
  }

  public close(): this {
    if (this.#loopId) clearTimeout(this.#loopId);
    this.socket.close();
    return this;
  }
}
