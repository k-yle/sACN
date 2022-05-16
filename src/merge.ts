import { Packet, Receiver } from "./index";
import { AssertionError } from "assert";

interface MergeProps {
    universes?: number[];
    port?: number;
    iface?: string;
    reuseAddr?: boolean;
    timeout?: number;
}

export class ReceiverMerge extends Receiver {
    constructor({ timeout = 5000, ...props }: MergeProps) {
        super(props);
        this.timeout = timeout;
        super.on("packet", this.mergePacket);
    }
    readonly timeout: number;
    protected senders = new Map<string, SendersData>();
    protected lastData = new sACNData();
    mergePacket(packet: Packet) {
        // used to identify each source (cid & universe)
        let sid = packet.universe.toString(36) + "     " + packet.cid.toString();
        // console.log(sid);
        if (!this.senders.has(sid)) this.emit('senderConnect', {
            cid: packet.cid,
            universe: packet.universe,
            firstPacket: packet
        });
        this.senders.set(
            sid,
            {
                cid: packet.cid.toString(),
                data: new sACNData(packet.payload),
                prio: packet.priority,
                seq: packet.sequence,
                universe: packet.universe,
            });
        setTimeout(() => {
            if (this.senders.get(sid)?.seq == packet.sequence) {
                this.senders.delete(sid);
                // `packet` is the last packet the source sent
                this.emit('senderDisconnect', {
                    cid: packet.cid,
                    universe: packet.universe,
                    lastPacket: packet
                });
            };
        }, this.timeout);

        // detect which source has the highest per-universe priority
        let maximumPrio = 0;
        for (let [_, data] of this.senders) {
            if (data.prio > maximumPrio && data.universe == packet.universe) {
                maximumPrio = data.prio;
            }
        }

        // HTP
        let mergedData = new sACNData();
        for (let [_, data] of this.senders) {
            if (data.prio == maximumPrio && data.universe == packet.universe) {
                let i = 0;
                while (i < 512) {
                    let newValue = data.data.data[i] || 0;
                    if ((mergedData.data[i] ?? 0) < newValue) mergedData.data[i] = newValue;
                    i++;
                }
            }
        }

        // console.log(mergedData);
        // only changes
        let i = 0;
        while (i < 512) {
            if (this.lastData.data[i] != mergedData.data[i]) {
                super.emit("changed", {
                    universe: packet.universe,
                    addr: i + 1,
                    newValue: mergedData.data[i],
                    oldValue: this.lastData.data[i]
                })
            }
            this.lastData.data[i] = mergedData.data[i] || 0;
            i++;
        }
        super.emit("changesDone");
    }
    clearCache() {
        // causes every addr value to be emitted
        this.lastData = new sACNData();
    }
    getSenders() {
        return [...this.senders.keys()].map(([cid, universe]) => ({ cid, universe }));
    }
}
export declare interface ReceiverMerge {
    on(event: string, listener: (...args: any[]) => void): this;
    on(event: Parameters<Receiver['on']>[0], listener: Parameters<Receiver['on']>[1]): this;
    on(event: "changed", listener: (ev: {
        universe: number,
        addr: number,
        newValue: number,
        oldValue: number
    }) => void): this;
    on(event: "changesDone", listener: () => void): this;
    on(event: "senderConnect", listener: (ev: {
        cid: number,
        universe: number,
        firstPacket: Packet
    }) => void): this;
    on(event: "senderDisconnect", listener: (ev: {
        cid: number,
        universe: number,
        lastPacket: Packet
    }) => void): this;
    on(event: 'packet', listener: (packet: Packet) => void): this;
    on(event: 'PacketCorruption', listener: (err: AssertionError) => void): this;
    on(event: 'PacketOutOfOrder', listener: (err: Error) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
}
interface SendersData {
    readonly cid: string,
    readonly data: sACNData,
    readonly prio: number,
    readonly seq: number,
    readonly universe: number,
}
export class sACNData {
    data: number[] = new Array(512);
    constructor(recordData: Record<number, number> = {}) {
        this.data.fill(0);
        for (let addr in recordData) {
            this.data[+addr - 1] = recordData[+addr] ?? 0;
        }
    }
}