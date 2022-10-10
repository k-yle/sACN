import { ReceiverMerge } from "../src/index";

export async function main() {
    const sacn = new ReceiverMerge({
        universes: [1, 2],
        reuseAddr: true,
    })
    sacn.on("changed", (ev) => {
        console.log(ev.universe, ev.addr, Math.round(ev.newValue * 2.55));
    })
}
main();
