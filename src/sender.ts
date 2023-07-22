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

  /** some options can be sepecified when you instantiate the sender, instead of sepecifying them on every packet */
  defaultPacketOptions?: Pick<Options, 'cid' | 'sourceName' | 'priority'>;

  // IPv4 address of the network interface
  iface?: string;

  /**
   * If you set this option to an IP address, then data will be sent
   * purely to this address, instead of the whole network.
   *
   * This option is not recommended and may not be supported by all devices.
   */
  useUnicastDestination?: string;
}

export class Sender {
  private socket: Socket;

  private readonly port: Props['port'];

  public readonly universe: Props['universe'];

  /**
   * this is normally a multicast address, but it could be
   * a unicast address if the user configures `useUnicastDestination`
   */
  readonly #destinationIp: string;

  private readonly defaultPacketOptions: Props['defaultPacketOptions'];

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
    defaultPacketOptions,
    iface,
    useUnicastDestination,
  }: Props) {
    this.port = port;
    this.universe = universe;
    this.#destinationIp = useUnicastDestination || multicastGroup(universe);
    this.defaultPacketOptions = defaultPacketOptions;

    this.socket = createSocket({ type: 'udp4', reuseAddr });

    if (iface || reuseAddr) {
      // prevent different behavior due to socket.bind() side effects, but binding the socket when reuseAddr: false could cause problems
      this.socket.bind(port, () => {
        // need to bind socket first
        if (iface) {
          this.socket.setMulticastInterface(iface);
        }
      });
    }

    if (minRefreshRate) {
      this.#loopId = setInterval(() => this.reSend(), 1000 / minRefreshRate);
    }
  }

  public send(packet: Omit<Options, 'sequence' | 'universe'>): Promise<void> {
    const finalPacket = { ...this.defaultPacketOptions, ...packet };
    this.#latestPacketOptions = finalPacket;
    return new Promise((resolve, reject) => {
      const { buffer } = new Packet({
        ...finalPacket,
        universe: this.universe,
        sequence: this.sequence,
      });
      this.sequence = (this.sequence + 1) % 256;
      this.socket.send(buffer, this.port, this.#destinationIp, (err) =>
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
