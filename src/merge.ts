import { Packet, Receiver } from "./index";

interface MergeProps {
    universes?: number[];
    port?: number;
    iface?: string;
    reuseAddr?: boolean;
    timeout?: number;
}

export class ReceiverMerge extends Receiver {
    constructor({
        universes = [1],
        port = 5568,
        iface = undefined,
        reuseAddr = false,
        timeout = 5000,
    }: MergeProps) {
        super({
            universes,
            port,
            iface,
            reuseAddr
        });
        this.timeout = timeout;
        super.on("packet", this.mergePacket);
    }
    readonly timeout: number;
    protected senders = new Map<string, SendersData>();
    protected lastData = new sACNData();
    mergePacket(packet: Packet) {
        // used to identify each source (cid & universe)
        let pid: string = packet.cid.toString() + "#" + packet.universe.toString();
        this.senders.set(
            pid,
            new SendersData(
                packet.cid.toString(),
                new sACNData(packet.payload),
                packet.priority,
                packet.sequence
            ));
        setTimeout(() => {
            if (this.senders.get(pid)?.seq == packet.sequence) this.senders.delete(pid);
        }, this.timeout);

        // detect which source has the highest per-universe priority
        let maximumPrio = 0;
        for (let [_, data] of this.senders) {
            if (data.prio > maximumPrio) {
                maximumPrio = data.prio;
            }
        }

        // HTP
        let mergedData = new sACNData();
        for (let [_, data] of this.senders) {
            if (data.prio == maximumPrio) {
                let i = 0;
                while (i < 512) {
                    let newValue = data.data.data[i];
                    if (mergedData.data[i] < newValue) mergedData.data[i] = newValue;
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
            this.lastData.data[i] = mergedData.data[i]
            i++;
        }
    }
}
class SendersData {
    constructor(
        readonly cid: string,
        readonly data: sACNData,
        readonly prio: number,
        readonly seq: number
    ) {

    }
}
export class sACNData {
    data: number[] = new Array(512);
    constructor(recordData: Record<number, number> = {}) {
        this.data.fill(0);
        for (let addr in recordData) {
            this.data[+addr - 1] = recordData[+addr];
        }
    }
}
