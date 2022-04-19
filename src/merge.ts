import { Packet, Receiver } from "./index";

interface MergeProps {
    universes?: number[];
    port?: number;
    iface?: string;
    reuseAddr?: boolean;
    timeout?: number;
}
type Sid = [string, number]

export class ReceiverMerge extends Receiver {
    constructor({ timeout = 5000, ...props }: MergeProps) {
        super(props);
        this.timeout = timeout;
        super.on("packet", this.mergePacket);
    }
    readonly timeout: number;
    protected senders = new Map<Sid, SendersData>();
    protected lastData = new sACNData();
    mergePacket(packet: Packet) {
        // used to identify each source (cid & universe)
        let sid: Sid = [packet.cid.toString(), packet.universe];
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
                seq: packet.sequence
            });
        setTimeout(() => {
            if (this.senders.get(sid)?.seq == packet.sequence) {
                this.senders.delete(sid);
                // `packet` is the last packet the source sent
                this.emit('senderDisonnect', {
                    cid: packet.cid,
                    universe: packet.universe,
                    lastPacket: packet
                });
            };
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
                    let newValue = data.data.data[i] || 0;
                    //if(mergedData is not defined) do nothing
                    if (mergedData.data[i] || Infinity < newValue) mergedData.data[i] = newValue;
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
    }
    getSenders() {
        return [...this.senders.keys()].map(([cid, universe]) => ({ cid, universe }));
    }
}
interface SendersData {
    readonly cid: string,
    readonly data: sACNData,
    readonly prio: number,
    readonly seq: number
}
export class sACNData {
    data: number[] = new Array(512);
    constructor(recordData: Record<number, number> = {}) {
        this.data.fill(0);
        for (let addr in recordData) {
            this.data[+addr - 1] = recordData[+addr] || 0;
        }
    }
}
