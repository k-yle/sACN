# sACN receiver & sender in node.js

[![Build Status](https://github.com/k-yle/sACN/workflows/Build%20and%20Test/badge.svg)](https://github.com/k-yle/sACN/actions)
[![Coverage Status](https://coveralls.io/repos/github/k-yle/sACN/badge.svg?branch=main)](https://coveralls.io/github/k-yle/sACN?branch=main)
[![npm version](https://badge.fury.io/js/sacn.svg)](https://badge.fury.io/js/sacn)
[![npm](https://img.shields.io/npm/dt/sacn.svg)](https://www.npmjs.com/package/sacn)
[![install size](https://packagephobia.com/badge?p=sacn)](https://packagephobia.com/result?p=sacn)

💡 This module can receive [DMX](https://en.wikipedia.org/wiki/DMX512) data sent via [sACN](https://en.wikipedia.org/wiki/E1.31) from professional lighting consoles (e.g. [ETC](https://www.etcconnect.com/), [Onyx](https://obsidiancontrol.com/)).

🎭 It can also send data to DMX fixtures that support sACN, e.g. LED lights, smoke machines, etc.

## Install

```bash
npm install sacn
```

## Usage - Receiver

🔦 Sending [RDM](<https://en.wikipedia.org/wiki/RDM_(lighting)>) data to fixtures is not implemented yet, see [issue #1](https://github.com/k-yle/sACN/issues/1).

```js
const { Receiver } = require('sacn');

const sACN = new Receiver({
  universes: [1, 2],
  // see table 1 below for all options
});

sACN.on('packet', (packet) => {
  console.log('got dmx data:', packet.payload);
  // see table 2 below for all packet properties
});

sACN.on('PacketCorruption', (err) => {
  // trigged if a corrupted packet is received
});

sACN.on('PacketOutOfOrder', (err) => {
  // trigged if a packet is received out of order
});

/* advanced usage below */

sACN.on('error', (err) => {
  // trigged if there is an internal error (e.g. the supplied `iface` does not exist)
});

// start listening to a new universe (universe 3 in this example)
sACN.addUniverse(3);

// stop listening to a universe 1
sACN.removeUniverse(1);

// close all connections; terminate the receiver
sACN.close();

sACN.universes; // is a list of the universes being listened to
```

### Table 1 - Options for Receiver

| Name        | Type       | Purpose                                                                                                                                     | Default |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `universes` | `number[]` | Required. List of universes to listen to. Must be within 1-63999                                                                            | `[]`    |
| `port`      | `number`   | Optional. The multicast port to use. All professional consoles broadcast to the default port.                                               | `5568`  |
| `iface`     | `string`   | Optional. If the computer is connected to multiple networks, specify which network adaptor to use by using this computer's local IP address | `null`  |
| `reuseAddr` | `boolean`  | Optional. Allow multiple programs on your computer to listen to the same sACN universe.                                                     | `false` |

### Table 2 - Packet properties

```js
{
  "sourceName": "Onyx", // controller that sent the packet
  "sourceAddress": "192.168.1.69", // ip address of the controller
  "universe": 1, // DMX universe
  "sequence": 172, // packets are numbered 0-255 to keep them in order
  "priority": 100, // 0-200. used if multiple controllers send to the same universe
  "payload": { // an object with the percentage values of DMX channels 1-512
    1: 100,
    2: 50,
    3: 0
  },

  /* there are more low-level properties which most
     users won't need, see the ./src/packet.ts file */
}
```

## Usage - Sender

```js
const { Sender } = require('sacn');

const sACNServer = new Sender({
  universe: 1,
  // see table 3 below for all options
});

async function main() {
  await sACNServer.send({
    payload: {
      // Required. An object with the percentages (0-100) for each DMX channel.
      // You can use 0-255 instead of 0-100 by setting `useRawDmxValues: true`
      // per packet, or in the `defaultPacketOptions`.
      1: 100,
      2: 50,
      3: 0,
    },
    sourceName: "My NodeJS app", // optional. LED lights will use this as the name of the source lighting console.
    priority: 100, // optional. value between 0-200, in case there are other consoles broadcasting to the same universe
  });

  sACNServer.close(); // terminate the server when your app is about to exit.
}

main(); // wrapped in a main() function so that we can `await` the promise
```

### Table 3 - Options for Sender

| Name                   | Type      | Purpose                                                                                                    | Default |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| `universe`             | `number`  | Required. The universe to send to. Must be within 1-63999                                                  |         |
| `port`                 | `number`  | Optional. The multicast port to use. All professional consoles broadcast to the default port.              | `5568`  |
| `reuseAddr`            | `boolean` | Optional. Allow multiple programs on your computer to send to the same sACN universe.                      |
| `defaultPacketOptions` | `object`  | Optional. You can specify options like `sourceName`, `cid`, `priority` and `useRawDmxValues` here instead of on every packet |
| `iface`                | `string`  | Optional. Specifies the IPv4 address of the network interface/card to use.                                 | OS default interface (=active internet connection)
| `minRefreshRate`       | `number`  | Optional. How often the data should be re-sent (*in Hertz/Hz*), even if it hasn't changed. By default data will only be sent once (equivilant of setting `refreshRate: 0`). To re-send data 5 times per second (`5Hz`), set `refreshRate: 5`. This is equivilant to `200ms`.                                 | `0`
| `useUnicastDestination`| `string`  | Optional. Setting this attribute to an IPv4 address will cause data to be sent directly to that device, instead of broadcasting to the whole LAN. |

# Contribute

```bash
npm run build # compile typescript
npm test # run tests
```

# Network Requirements

- [x] Multicast must be enabled<sup id="footnote-source1">[1](#footnote1)</sup>. sACN uses port `5568` on `239.255.x.x`
- [x] Network infrastructure that supports at least 100Mbps (100BaseT)

# Protocol Docs

The Architecture for Control Networks (ACN) and derived protocols are created by the Entertainment Services and Technology Association.

- sACN is defined in [ANSI E1.31](./docs/E1.31-2018.pdf)
- RDMNet is defined in [ANSI E1.33](./docs/E1.33-2019.pdf)

---

<small id="footnote1">

1&shy;. Unicast is also supported by default, but this is not how sACN normally works. See [_Table 3_](#table-3---options-for-sender) for how to send data directly to a unicast address. [↩](#footnote-source1)

</small>
